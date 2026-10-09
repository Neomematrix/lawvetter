import {readNews} from '../../news/store';
import {validateEdition} from '../../news/types';
import {rawDb} from '../../../db/raw';
import {profileIdentity,sameOrigin} from '../../../db/profile-access';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json(await readNews(),{headers:{'Cache-Control':'no-store'}});}catch(e){console.error('News read failed',e);return Response.json({error:'News temporarily unavailable'},{status:503});}}
// This Site is owner-private. Dispatch authenticates non-user service requests.
// If sharing changes, disable service writes until a separate writer credential is configured.
export async function PUT(request:Request){
 const identity=profileIdentity(request);
 if(!sameOrigin(request)||(identity.user&&!identity.admin))return Response.json({error:'Forbidden'},{status:403});
 try{
  const text=await request.text();if(text.length>5000000)return Response.json({error:'Edition too large'},{status:413});
  const body=JSON.parse(text);const expectedUpdatedAt=body?.expectedUpdatedAt;
  if(!validateEdition(body)||!(expectedUpdatedAt===null||typeof expectedUpdatedAt==='string'))return Response.json({error:'Expected 12 unique featured articles, at least two marked familyLaw, complete articles and expectedUpdatedAt.'},{status:400});
  const current=await readNews();
  if(expectedUpdatedAt!==current.updatedAt)return Response.json({error:'Edition changed. Read and merge again.'},{status:409});
  const incoming=new Set(body.articles.map(a=>a.slug));
  if(current.articles.some(a=>!incoming.has(a.slug)))return Response.json({error:'Keep all archived article URLs.'},{status:400});
  const updatedAt=new Date().toISOString(),payload=JSON.stringify({articles:body.articles,featured:body.featured}),db=rawDb();
  const result=current.updatedAt===null?await db.prepare("INSERT OR IGNORE INTO news_state(id,payload,updated_at) VALUES('current',?,?)").bind(payload,updatedAt).run():await db.prepare("UPDATE news_state SET payload=?,updated_at=? WHERE id='current' AND updated_at=?").bind(payload,updatedAt,current.updatedAt).run();
  if(result.meta.changes!==1)return Response.json({error:'Edition changed. Read and merge again.'},{status:409});
  return Response.json({saved:true,updatedAt,featured:body.featured},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('News update failed',e);return Response.json({error:'News update failed'},{status:500});}
}
