import {adminIdentity} from '../../../../db/admin-auth';
import {rawDb} from '../../../../db/raw';
import {claimedProfilesFrom,claimedProfilesWhere} from '../../../../db/claimed-profiles';
export async function GET(request:Request){
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
 if(!await adminIdentity(request))return json({error:'Sign in as administrator.'},401);
 try{const url=new URL(request.url),q=(url.searchParams.get('q')||'').trim().slice(0,150),page=Math.max(1,Math.min(100000,Number(url.searchParams.get('page'))||1)),db=rawDb();
 const where=claimedProfilesWhere+(q?' AND (a.name LIKE ? OR a.company LIKE ? OR c.legal_name LIKE ? OR c.email LIKE ?)':''),args=q?Array(4).fill('%'+q+'%'):[];
 const [total,rows]=await Promise.all([db.prepare('SELECT COUNT(*) AS total FROM '+claimedProfilesFrom+' WHERE '+where).bind(...args).first<{total:number}>(),db.prepare('SELECT a.bar_number,a.public_id,a.name,a.company,a.state,p.claimed_at,c.legal_name AS owner_name,c.email AS owner_email FROM '+claimedProfilesFrom+' WHERE '+where+' ORDER BY p.claimed_at DESC,a.name,a.bar_number LIMIT 25 OFFSET ?').bind(...args,(page-1)*25).all()]);return json({profiles:rows.results,total:total?.total||0,page});
 }catch{return json({error:'Unable to load claimed profiles.'},503);}
}
