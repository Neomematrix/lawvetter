import {guardProfileLoad} from './profile-load-guard';
import {AsyncLocalStorage} from 'node:async_hooks';
import {configurePublicReadScope} from '../db/public-read-cache';
import {readDeadline} from '../app/read-json';
import {invalidCityResponse} from './city-routes';
import {publicCachePolicy,cachedPublicResponse} from './public-cache';
import {siteAssetResponse} from './site-assets';
import {browserRecoveryResponse} from './browser-recovery';
import {landingPerformanceResponse} from './landing-performance';
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
declare const __LAWVETTER_BUILD_ID__: string;

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const publicReadScope=new AsyncLocalStorage<object>();
configurePublicReadScope(()=>publicReadScope.getStore()||{});

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if(url.pathname === '/api/site-release') {
      const headers = {'Content-Type':'application/json', 'Cache-Control':'no-store, max-age=0', 'CDN-Cache-Control':'no-store', 'X-Robots-Tag':'noindex'};
      if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
      return new Response(request.method==='HEAD'?null:JSON.stringify({version:__LAWVETTER_BUILD_ID__}),{headers});
    }
    const invalidCity=invalidCityResponse(request);
    if(invalidCity)return invalidCity;
    const recoveryResponse=browserRecoveryResponse(request);
    if(recoveryResponse)return recoveryResponse;
    const assetResponse=await siteAssetResponse(request,env.ASSETS);
    if(assetResponse)return assetResponse;

    // Load chart-only image code only for its dedicated public image endpoint.
    if (url.pathname.startsWith('/api/chart-avatar/')) {
      const {chartAvatarResponse}=await import('./chart-avatars');
      return (await chartAvatarResponse(request,env.ASSETS))!;
    }

    // Serve compiled files directly, including retained chunks from open tabs.
    if (url.pathname.startsWith('/assets/') && ['GET','HEAD'].includes(request.method)) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const adminPath=/^\/(admin|admin-login|api\/admin)(\/|$)/.test(url.pathname);
    const hasAdminCookie=(request.headers.get('cookie')||'').split(';').some(c=>c.trim().startsWith('__Host-lawvetter-admin='));
    if(hasAdminCookie&&url.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method)&&request.headers.get('origin')!==url.origin)return new Response('Invalid request origin.',{status:403});
    // Platform Workers use an isolated named cache; the default cache is restricted.
    let edgeCache:Cache|undefined;
    try{if(publicCachePolicy(request))edgeCache=await readDeadline(caches.open('lawvetter-public-'+__LAWVETTER_BUILD_ID__),1500);}catch(error){console.warn('Public cache unavailable',error);}
    const load=()=>{
      const work=publicReadScope.run({},()=>handler.fetch(request,env,ctx));
      if(!['GET','HEAD'].includes(request.method))return work;
      return readDeadline(work,20000).catch(error=>{
        console.error('Page or API read unavailable',url.pathname,error instanceof Error?error.message:'Unknown error');
        if(url.pathname.startsWith('/api/'))return Response.json({error:'The server is taking longer than expected. Please try again.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
        return new Response('LawVetter is taking longer than expected. Please reload this page.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','Retry-After':'5'}});
      });
    };
    const response=await cachedPublicResponse(request,()=>guardProfileLoad(request,load),edgeCache,promise=>ctx.waitUntil(promise));
    if(!adminPath)return landingPerformanceResponse(request,response);
    const secured=new Response(response.body,response);
    secured.headers.set('Cache-Control','private, no-store');
    secured.headers.set('Referrer-Policy','no-referrer');
    secured.headers.set('X-Content-Type-Options','nosniff');
    secured.headers.set('X-Frame-Options','DENY');
    secured.headers.set('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'");
    secured.headers.set('X-Robots-Tag','noindex, nofollow');
    return secured;
  },
};

export default worker;
