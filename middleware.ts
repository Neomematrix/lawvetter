import {NextResponse,type NextRequest} from 'next/server';
import {siteOrigin} from './db/site-settings';
export async function middleware(request:NextRequest){
 if(!['GET','HEAD'].includes(request.method))return NextResponse.next();
 const pathname=request.nextUrl.pathname;
 if(/^\/api(\/|$)/.test(pathname))return NextResponse.next();
 const primary=await siteOrigin(),current=request.nextUrl.origin;
 if(primary!==current&&['https://lawvetter.kyle-george-1801.chatgpt.site','https://lawvetter.com','https://www.lawvetter.com'].includes(current))return NextResponse.redirect(new URL(pathname+request.nextUrl.search,primary),308);
 return NextResponse.next();
}
