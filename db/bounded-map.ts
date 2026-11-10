// Process fixed-size groups; preserve input order and stop before scheduling the
// next group if a lookup fails. This does not change the import write transaction.
export async function boundedMap<T,U>(values:T[],limit:number,load:(value:T,index:number)=>Promise<U>):Promise<U[]>{
 if(!Number.isInteger(limit)||limit<1)throw Error('Invalid concurrency limit');
 const results:U[]=[];
 for(let start=0;start<values.length;start+=limit){
  results.push(...await Promise.all(values.slice(start,start+limit).map((value,index)=>load(value,start+index))));
 }
 return results;
}
