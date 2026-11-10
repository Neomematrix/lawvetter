import {stateSearch,usStates} from '../../us-states';
import {usCities} from '../../us-cities';

// Suggest only city/state pairs from the sourced US location catalog.
// Imported attorney city fields can contain addresses or a mismatched state.
const locations=Object.entries(usCities).flatMap(([state,cities])=>cities.map(city=>({city,state,label:city+', '+state})));
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,state=(params.get('state')||'').trim().toUpperCase(),query=(params.get('q')||'').trim().slice(0,120);
 if(state&&!usStates.includes(state as typeof usStates[number]))return Response.json({error:'Choose a state.'},{status:400});
 if(params.get('format')==='locations'){
  const parts=query.split(','),typedState=parts.length>1?stateSearch(parts.slice(1).join(',').trim()):'',wholeState=stateSearch(query);
  if(parts.length>1&&!typedState||state&&typedState&&state!==typedState)return Response.json({locations:[]});
  const selectedState=state||typedState||wholeState,q=wholeState?'':parts[0].trim().toLowerCase();
  if(q.length<2&&!selectedState)return Response.json({locations:[]});
  return Response.json({locations:locations.filter(row=>(!selectedState||row.state===selectedState)&&row.city.toLowerCase().startsWith(q)).sort((a,b)=>a.label.localeCompare(b.label)).slice(0,12)},{headers:{'Cache-Control':'public, max-age=300'}});
 }
 const q=query.toLowerCase(),names=state?usCities[state]||[]:Object.values(usCities).flat();
 const cities=[...new Map(names.filter(city=>city.toLowerCase().startsWith(q)).map(city=>[city.toLowerCase(),city])).values()].sort((a,b)=>a.localeCompare(b)).slice(0,12);
 return Response.json({cities},{headers:{'Cache-Control':'public, max-age=300'}});
}
