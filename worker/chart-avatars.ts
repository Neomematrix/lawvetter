import manifest from './chart-avatar-manifest.json';
import optimizedManifest from './chart-avatar-optimized-manifest.json';
const images:Record<string,string>=manifest;

// Only versioned public chart portraits use this path. Private submission
// photos, account endpoints and original profile-photo behavior are untouched.
export async function chartAvatarResponse(request:Request,assets:Fetcher):Promise<Response|null>{
 const url=new URL(request.url),prefix='/api/chart-avatar/';
 if(!url.pathname.startsWith(prefix))return null;
 const failure=(message:string,status:number)=>new Response(message,{status,headers:{'Cache-Control':'no-store'}});
 if(!['GET','HEAD'].includes(request.method))return failure('Method not allowed',405);
 const name=url.pathname.slice(prefix.length),placeholder=/^placeholder(?:\.v2)?\.webp$/.test(name),optimized=name.includes('.v2');
 const match=/^(LV[0-9a-f]{32})\.(p[0-9a-f]+)(?:\.v2)?(@3x)?\.webp$/.exec(name);
 if(url.search||(!placeholder&&!match))return failure('Not found',404);
 const key=placeholder?'placeholder':match![1]+'.'+match![2]+(match![3]||'');
 const original=placeholder?'/attorneys/placeholder.73de70770474.webp':'/api/profile-photo?bar='+match![1]+'&v='+match![2];
 const fallback=()=>new Response(null,{status:307,headers:{Location:new URL(original,url).href,'Cache-Control':'no-store'}});
 const selected:Record<string,string>=optimized?optimizedManifest:images;
 const path=Object.hasOwn(selected,key)?selected[key]:undefined;
 if(!path)return fallback(); // Newly published/replaced portraits stay current.
 try{
  const result=await assets.fetch(new Request(new URL(path,url),{method:request.method}));
  if(result.status!==200||!/^image\/webp/i.test(result.headers.get('Content-Type')||''))return fallback();
  const headers=new Headers({'Content-Type':'image/webp','Cache-Control':placeholder&&!optimized?'public, max-age=300':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});
  const length=result.headers.get('Content-Length');if(length)headers.set('Content-Length',length);
  return new Response(request.method==='HEAD'?null:result.body,{status:200,headers});
 }catch{return fallback();}
}
