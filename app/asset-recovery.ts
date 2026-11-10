// Runs before app modules, including when the module graph cannot load.
export const assetRecoveryScript=`(function(){
 var recovering=false,reports=0,edited=false;
 addEventListener('input',function(){edited=true;},true);
 addEventListener('change',function(){edited=true;},true);
 function report(kind,message){
  if(reports++>4)return;
  try{navigator.sendBeacon('/api/site-load-report',new Blob([JSON.stringify({kind:kind,path:location.pathname,message:String(message||'').slice(0,300)})],{type:'application/json'}));}catch(e){}
 }
 function freshUrl(){var url=new URL(location.href);url.searchParams.set('_lv_reload',String(Date.now()));return url.href;}
 function show(){
  if(document.getElementById('lawvetter-load-error'))return;
  var message=document.createElement('div');message.id='lawvetter-load-error';message.setAttribute('role','alert');message.style.cssText='position:fixed;inset:auto 16px 24px;z-index:2147483647;padding:20px;background:white;color:#123c60;border:1px solid #abc6dd;border-radius:12px;font:16px Arial;box-shadow:0 4px 24px #0002';message.textContent='LawVetter could not finish loading. ';
  var link=document.createElement('a');link.textContent='Reload page';link.href=freshUrl();link.style.cssText='color:#125b91;font-weight:bold;text-decoration:underline';message.appendChild(link);
  (document.body||document.documentElement).appendChild(message);
 }
 function recover(){
  if(recovering)return;recovering=true;
  // Wait for streaming to finish before navigating. The URL marker prevents
  // repeated recovery, even when sessionStorage is unavailable.
  function finish(){
   show();
   if(edited||new URL(location.href).searchParams.has('_lv_reload'))return;
   location.replace(freshUrl());
  }
  if(document.readyState==='loading')addEventListener('DOMContentLoaded',finish,{once:true});
  else finish();
 }
 function moduleError(message){return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Failed to load module script/i.test(message);}
 addEventListener('error',function(event){var target=event.target;if(target&&target.tagName==='SCRIPT'&&/\\/(?:assets|api\\/lv-assets-[0-9a-f-]{36}|api\\/site-assets)\\//.test(target.src||'')){report('asset',new URL(target.src,location.href).pathname);recover();}else if(event.message){report('javascript',event.message);if(moduleError(String(event.message)))recover();}},true);
 addEventListener('vite:preloadError',function(event){report('preload',event.payload&&event.payload.message);event.preventDefault();recover();});
 addEventListener('unhandledrejection',function(event){var message=String(event.reason&&event.reason.message||event.reason||'');report('rejection',message);if(moduleError(message)){event.preventDefault();recover();}});
 addEventListener('DOMContentLoaded',function(){report('document','ready');setTimeout(function(){if(!document.body||document.body.innerText.trim().length<20){report('blank','No visible page content after initialization');show();}},5000);});
})();`;
