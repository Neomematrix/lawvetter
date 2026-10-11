import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const cache=new Map();
function readModule(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file);
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};cache.set(file,module.exports);
 vm.runInThisContext('(function(require,module,exports){'+source+'\n})',{filename:file})(specifier=>readModule(path.resolve(path.dirname(file),specifier)+'.ts'),module,module.exports);
 return module.exports;
}
const {websitesByFirm,firmWebsites,linkedInByFirm,attorneyLinkedIn}=readModule('app/firm-websites.ts');
const {firmKey}=readModule('app/api/attorneys/firm.ts');
const {verifiedFirmForAttorney}=readModule('app/verified-firm-rosters.ts');
const records=fs.readFileSync('data/georgia-attorneys.jsonl','utf8').trim().split('\n').map(JSON.parse);
const report={checked:new Date().toISOString(),recordsReviewed:records.length,firmNameMappings:Object.keys(websitesByFirm).length,distinctFirmWebsites:new Set(Object.values(websitesByFirm)).size,attorneysWithWebsite:records.filter(a=>firmWebsites[a.barNumber]||websitesByFirm[firmKey(verifiedFirmForAttorney(a.barNumber)?.name||a.company)]).length,firmLinkedInMappings:Object.keys(linkedInByFirm).length,distinctFirmLinkedIn:new Set(Object.values(linkedInByFirm)).size,attorneyLinkedInProfiles:Object.keys(attorneyLinkedIn).length,withoutPublishedAffiliation:records.filter(a=>!a.company).length,completeWebsiteVerification:false,completeLinkedInVerification:false};
report.attorneysWithoutVerifiedWebsite=records.length-report.attorneysWithWebsite;
fs.writeFileSync('data/contact-coverage-summary.json',JSON.stringify(report,null,2)+'\n');
const audit=JSON.parse(fs.readFileSync('data/firm-website-audit.json','utf8'));
for(const affiliation of audit.affiliations){
 const website=websitesByFirm[affiliation.key];
 if(website){affiliation.status='linked';affiliation.website=website;affiliation.linkedin=linkedInByFirm[affiliation.key]||'';}
}
audit.coverage=report;fs.writeFileSync('data/firm-website-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(report));
