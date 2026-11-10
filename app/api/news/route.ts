export const dynamic='force-dynamic';
function retired(){return Response.json({error:'Legal news is no longer available.'},{status:410,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});}
export async function GET(){return retired();}
export async function PUT(_request:Request){return retired();}
