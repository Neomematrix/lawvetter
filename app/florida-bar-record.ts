// Official imports must come from a reviewed individual member page, not a search result.
export function validateFloridaMemberRecord(row:Record<string,unknown>){
 const bar=String(row.barNumber||'');
 if(row.state!=='FL'||!/^[0-9]{1,10}$/.test(bar)||row.verifiedBarNumber!==bar||row.membershipStatus!=='Member in Good Standing'||row.eligibility!=='Eligible to Practice Law in Florida')throw Error('Verify the matching Florida member page, good standing, and eligibility.');
 let source:URL;try{source=new URL(String(row.sourceUrl||''));}catch{throw Error('Use the Personal Bar URL published on the verified member page.');}
 if(source.protocol!=='https:'||source.hostname!=='www.floridabar.org'||source.port||source.username||source.password||source.search||source.hash||!/^\/mybarprofile\/[^/]+$/.test(source.pathname)||/%2f/i.test(source.pathname))throw Error('Use the Personal Bar URL published on the verified member page.');
 const personalId=source.pathname.split('/').pop()!;if(/^\d+$/.test(personalId)&&personalId!==bar)throw Error('The official member URL must match the verified Florida Bar number.');
 if(typeof row.verifiedAt!=='string'||!Number.isFinite(Date.parse(row.verifiedAt)))throw Error('Individual member verification date is required.');
 if(typeof row.admitDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row.admitDate)||!Number.isFinite(Date.parse(row.admitDate))||new Date(row.admitDate).toISOString().slice(0,10)!==row.admitDate||typeof row.lawSchool!=='string')throw Error('Collect the admission date and law school from the individual member page. Leave law school empty only when the Bar does not publish it.');
}
