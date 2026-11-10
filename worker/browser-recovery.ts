export function browserRecoveryResponse(request:Request):Response|null{
 if(new URL(request.url).pathname!=='/recover'||!['GET','HEAD'].includes(request.method))return null;
 const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reload LawVetter</title><body style="font:18px Arial,sans-serif;max-width:560px;margin:10vh auto;padding:24px;color:#173d5d"><h1>Reopen LawVetter</h1><p>This page asks your browser to clear cached LawVetter files. Your login cookies are preserved.</p><p><a href="/" style="display:inline-block;background:#17689b;color:white;padding:16px 24px;border-radius:8px;text-decoration:none">Continue to LawVetter</a></p></body></html>';
 return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Clear-Site-Data':'"cache"','X-Robots-Tag':'noindex, nofollow'}});
}
