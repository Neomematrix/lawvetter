export const viewAsCookieName='__Host-lawvetter-view-as';
export function viewAsToken(request:Request){return request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith(viewAsCookieName+'='))?.slice(viewAsCookieName.length+1)||'';}
export function viewAsCookie(token:string){return `${viewAsCookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token?7200:0}`;}
