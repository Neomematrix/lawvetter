import {rawDb} from './raw';
export const visitorPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function visitorStatement(id:unknown,converted=0){
 if(typeof id!=='string'||!visitorPattern.test(id))return null;
 const month=new Date().toISOString().slice(0,7);
 return rawDb().prepare('INSERT INTO inquiry_visitors(key,month,converted) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET converted=MAX(converted,excluded.converted)').bind(month+':'+id,month,converted);
}
export async function inquiryMetrics(){const month=new Date().toISOString().slice(0,7);return await rawDb().prepare('SELECT COUNT(*) AS visitors,COALESCE(SUM(converted),0) AS inquirers FROM inquiry_visitors WHERE month=?').bind(month).first<{visitors:number;inquirers:number}>();}
