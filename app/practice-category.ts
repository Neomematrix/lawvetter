import {practiceAreas,searchPracticeArea} from './practice-catalog';
export type PracticeCategory={id:string;name:string;description:string};
export const additionalPracticeAreas:PracticeCategory[]=[
 {id:'judge',name:'Judge',description:'Judicial profiles, court information and jurisdiction'},
 {id:'cannabis-law',name:'Cannabis Law',description:'Medical marijuana and hemp licensing, plus legal guidance for physicians and patients'},
 {id:'aviation',name:'Aviation',description:'Aircraft operations, accidents and regulatory compliance'},
 {id:'business-and-commercial-disputes',name:'Business & Commercial Disputes',description:'Contract conflicts, business claims and commercial disputes'},
 {id:'civil-litigation',name:'Civil Litigation',description:'Civil claims, lawsuits and dispute resolution'},
 {id:'commercial-litigation',name:'Commercial Litigation',description:'Business lawsuits and commercial contract disputes'},
 {id:'consumer',name:'Consumer',description:'Consumer rights, unfair practices and purchase disputes'},
 {id:'intellectual-property',name:'Intellectual Property',description:'Trademarks, copyrights and creative rights'},
 {id:'international-arbitration',name:'International Arbitration',description:'Cross-border disputes resolved through arbitration'},
 {id:'labor',name:'Labor',description:'Unions, collective bargaining and workplace relations'},
 {id:'litigation-and-disputes',name:'Litigation & Disputes',description:'Lawsuits, negotiations and dispute resolution'},
 {id:'patent',name:'Patent',description:'Invention protection, patent filings and infringement'},
 {id:'real-estate',name:'Real Estate',description:'Property sales, leases, titles and land disputes'},
 {id:'social-security-and-disability',name:'Social Security & Disability',description:'Disability benefits, eligibility claims and appeals'},
 {id:'workers-compensation',name:'Workers Compensation',description:'Workplace injuries, medical benefits and lost wages'}
];
const descriptions=new Map(additionalPracticeAreas.map(area=>[area.id,area.description]));
descriptions.set('financial-law','Bankruptcy, debt relief, creditor disputes, and financial restructuring');
for(const id of ['entertainment','entertainment-law'])descriptions.set(id,'Legal help for artists, creators, and entertainment businesses.');
export function practiceAreaChoices(){return categoryList(additionalPracticeAreas.map(area=>area.name));}

export function practiceCategoryId(value:string){return searchPracticeArea(value)?.id||value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
export function splitPracticeAreas(value:string){return [...new Map(value.split(/[,;|\n]+/).map(name=>name.trim()).filter(Boolean).map(name=>searchPracticeArea(name)?.id==='employment-law'?'Employment Law':searchPracticeArea(name)?.id==='criminal-defense'?'Criminal Law':name).map(name=>[practiceCategoryId(name),name])).values()];}
export function categoryList(values:string[]):PracticeCategory[]{const all=new Map(practiceAreas.map(area=>[area.id,{...area}]));for(const value of values)for(const name of splitPracticeAreas(value)){const id=practiceCategoryId(name);if(id&&!all.has(id))all.set(id,{id,name,description:descriptions.get(id)||name+' advice and representation'});}return [...practiceAreas,...[...all.values()].filter(a=>!practiceAreas.some(base=>base.id===a.id)).sort((a,b)=>a.name.localeCompare(b.name))];}
