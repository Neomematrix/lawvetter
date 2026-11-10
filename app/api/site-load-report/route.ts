// Browser startup diagnostics contain no query strings, form fields or identity.
export async function POST(request:Request){
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return new Response(null,{status:403});
 if(Number(request.headers.get('content-length')||0)>2048)return new Response(null,{status:413});
 try{
  const text=await request.text();if(text.length>2048)return new Response(null,{status:413});
  const data=JSON.parse(text) as {kind?:unknown;path?:unknown;message?:unknown};
  if(typeof data.kind!=='string'||!['asset','javascript','preload','rejection','document','blank'].includes(data.kind)||typeof data.path!=='string'||typeof data.message!=='string')return new Response(null,{status:400});
  const report={kind:data.kind,path:data.path.split('?')[0].slice(0,180),message:data.message.slice(0,300)};
  if(data.kind==='document')console.info('LawVetter browser startup',JSON.stringify(report));
  else console.error('LawVetter browser startup',JSON.stringify(report));
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:400});}
}
