import {rawDb} from '../../../db/raw';
const commonCities:Record<string,string[]>={
 FL:['Tampa','St. Petersburg','Clearwater','Miami','Miami Beach','Orlando','Jacksonville','Tallahassee','Fort Lauderdale','West Palm Beach','Boca Raton','Sarasota','Naples','Fort Myers','Gainesville','Pensacola'],
 GA:['Atlanta','Marietta','Powder Springs','Canton','Woodstock','Roswell','Alpharetta','Decatur','Savannah','Augusta','Macon','Athens','Columbus','Kennesaw','Smyrna','Lawrenceville']
};
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,state=(params.get('state')||'').toUpperCase(),q=(params.get('q')||'').trim().slice(0,120);
 if(state&&!/^[A-Z]{2}$/.test(state))return Response.json({error:'Choose a state.'},{status:400});
 try{
  const escaped=q.replace(/[\\%_]/g,'\\$&');
  const rows=await rawDb().prepare("SELECT DISTINCT trim(city) AS city FROM attorneys WHERE trim(city)<>''"+(state?' AND state=?':'')+" AND lower(trim(city)) LIKE ? ESCAPE '\\' ORDER BY city COLLATE NOCASE LIMIT 20").bind(...(state?[state]:[]),escaped.toLowerCase()+'%').all<{city:string}>();
  const seeds=state?commonCities[state]||[]:Object.values(commonCities).flat();
  const cities=[...new Map([...rows.results.map(r=>r.city),...seeds.filter(city=>city.toLowerCase().startsWith(q.toLowerCase()))].map(city=>[city.toLowerCase(),city])).values()].sort((a,b)=>a.localeCompare(b)).slice(0,12);
  return Response.json({cities},{headers:{'Cache-Control':'public, max-age=300'}});
 }catch{return Response.json({error:'City suggestions are unavailable.'},{status:503});}
}
