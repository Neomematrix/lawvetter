import * as runtime from 'cloudflare:workers';
// Ranking is best effort: a failed analytics write must not fail a search.
export async function backgroundTask(label:string,load:()=>Promise<unknown>){
 const work=Promise.resolve().then(load).catch(error=>console.error(label,error instanceof Error?error.message:String(error)));
 if(runtime.waitUntil){runtime.waitUntil(work);return;}
 // Local runners without a Worker lifecycle still observe completion and errors.
 await work;
}
