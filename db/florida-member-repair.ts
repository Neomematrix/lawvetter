import {rawDb} from './raw';
import {validateFloridaMemberRecord} from '../app/florida-bar-record';
export type FloridaVerification={state:string;barNumber:string;verifiedBarNumber:string;sourceUrl:string;publishedSourceUrl?:string;verifiedAt:string;admitDate:string;lawSchool:string;county:string;membershipStatus:string;eligibility:string;name:string};
function text(html:string){return html.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n:string)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").trim();}
export function parseFloridaMember(html:string,barNumber:string):FloridaVerification{
 if(!/id=["']mProfile["']/.test(html))throw Error('The official member page is unavailable.');
 function field(label:string){const match=html.match(new RegExp('<label[^>]*>\\s*'+label+':\\s*</label>[\\s\\S]*?<p[^>]*>([\\s\\S]*?)</p>','i'));return match?text(match[1]):'';}
 if(field('Bar Number')!==barNumber)throw Error('Official member page does not match the Florida Bar number.');
 const admitted=field('Admitted'),date=admitted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
 const record={state:'FL',barNumber,verifiedBarNumber:barNumber,sourceUrl:field('Personal Bar URL'),verifiedAt:new Date().toISOString(),admitDate:date?date[3]+'-'+date[1]+'-'+date[2]:'',lawSchool:field('Law School'),county:field('County'),membershipStatus:text(html.match(/class=["'][^"']*member-status[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||''),eligibility:text(html.match(/class=["'][^"']*eligibility-eligible[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]||''),name:text(html.match(/<h1[^>]*class=["']full["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'')};
 validateFloridaMemberRecord(record);return {...record,publishedSourceUrl:record.sourceUrl,sourceUrl:'https://www.floridabar.org/mybarprofile/'+barNumber};
}
export async function applyFloridaVerification(record:FloridaVerification,originalSource:string){
 validateFloridaMemberRecord(record);record={...record,sourceUrl:new URL(record.sourceUrl).href};const db=rawDb(),now=new Date().toISOString();
 // Only records created by this specific import; retain all profile, photo, and owner data.
 const result=await db.prepare("UPDATE attorneys SET source_url=?,admit_date=CASE WHEN TRIM(admit_date)='' THEN ? ELSE admit_date END,law_school=CASE WHEN TRIM(law_school)='' THEN ? ELSE law_school END,county=CASE WHEN TRIM(county)='' THEN ? ELSE county END WHERE state='FL' AND COALESCE(license_number,bar_number)=? AND source_url IN (?,?) AND EXISTS(SELECT 1 FROM admin_audit a WHERE a.record_id=attorneys.bar_number AND a.actor='Florida Bar photo import' AND a.action='attorney-create')").bind(record.sourceUrl,record.admitDate,record.lawSchool,record.county,record.barNumber,originalSource,record.sourceUrl).run();
 await db.prepare('INSERT INTO site_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind('florida-member-verification:'+record.barNumber,JSON.stringify({...record,applied:result.meta.changes>0}),now).run();
 return result.meta.changes>0;
}
