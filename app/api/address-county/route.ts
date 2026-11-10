import {sameOrigin} from '../../../db/profile-access';
import {allowDirectoryAttempt} from '../../../db/directory-protection';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});
 try{
  const raw=await request.text();if(raw.length>1500)return Response.json({error:'Address is too long.'},{status:400});
  const data=JSON.parse(raw),address=typeof data.address==='string'?data.address.trim():'',zip=typeof data.zip==='string'?data.zip.trim():'',state=typeof data.state==='string'?data.state.trim().toUpperCase():'',city=typeof data.city==='string'?data.city.trim():'';
  if(address.length<4||address.length>500||city.length>120||!/^\d{5}(?:-\d{4})?$/.test(zip)||!/^[A-Z]{2}$/.test(state))return Response.json({error:'Enter the street address, state and ZIP code.'},{status:400});
  if(!await allowDirectoryAttempt(request,'address-county',120))return Response.json({error:'County lookup limit reached. Enter the county manually.'},{status:429});
  // Census matches street ranges, not suites. Preserve the user's full address
  // in the form and simplify only the lookup request.
  const street=address.replace(/,?\s+(?:(?:suite|ste|unit|apt|apartment|floor|fl)\.?\s*#?\s*[\w-]+|#\s*[\w-]+)\s*$/i,'').trim();
  const params={street,city,state,zip:zip.slice(0,5),benchmark:'Public_AR_Current',vintage:'Current_Current',format:'json'};
  const url=new URL('https://geocoding.geo.census.gov/geocoder/geographies/address');url.search=new URLSearchParams(params).toString();
  const fallback=new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
  fallback.search=new URLSearchParams({address:[street,city,state,zip.slice(0,5)].filter(Boolean).join(', '),benchmark:params.benchmark,vintage:params.vintage,format:'json'}).toString();
  type Match={addressComponents?:{state?:string;zip?:string};geographies?:{Counties?:{NAME?:string}[]}};
  let matches:Match[]=[],available=false;
  for(const endpoint of [url,fallback]){
   try{
    const response=await fetch(endpoint,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Lookup unavailable');
    const result=await response.json() as {result?:{addressMatches?:Match[]}};
    available=true;matches=result.result?.addressMatches||[];
    if(matches.length)break;
   }catch{/* Retry the alternate Census address parser before reporting failure. */}
  }
  if(!available)throw Error('Lookup unavailable');
  if(matches.length!==1)return Response.json({county:null},{headers:{'Cache-Control':'no-store'}});
  const match=matches[0];if(match.addressComponents?.state!==state||match.addressComponents?.zip?.slice(0,5)!==zip.slice(0,5))return Response.json({county:null},{headers:{'Cache-Control':'no-store'}});
  const counties=match.geographies?.Counties||[],county=counties.length===1?counties[0].NAME:'';
  return Response.json({county:county&&county.length<=120?county:null},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'County lookup is unavailable. Enter the county manually.'},{status:503});}
}
