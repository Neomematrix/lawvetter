export const practiceAreas = [
 {id:'family-law',name:'Family law',description:'Divorce, custody & family matters'},
 {id:'litigation',name:'Litigation',description:'Disputes & courtroom representation'},
 {id:'personal-injury',name:'Personal injury',description:'Injuries, accidents & liability'},
 {id:'criminal-defense',name:'Criminal Law',description:'Criminal matters & court proceedings'},
 {id:'employment-law',name:'Employment Law',description:'Workplace rights, disputes & employee benefits'},
 {id:'estate-planning',name:'Estate planning',description:'Wills, trusts & probate'},
 {id:'business-law',name:'Business law',description:'Companies, contracts & transactions'},
 {id:'immigration',name:'Immigration',description:'Visas, residency & citizenship'},
];

// Recognize a whole practice category without treating attorney or firm names as categories.
export function searchPracticeArea(value:string){const q=value.trim().toLowerCase().replace(/[-_]+/g,' ').replace(/&/g,' and ').replace(/\s+/g,' ');const aliases:Record<string,string>={'family':'family-law','criminal law':'criminal-defense','immigration law':'immigration','estate law':'estate-planning','business':'business-law','employment':'employment-law','employment and benefits':'employment-law','employment benefits':'employment-law','employment benefit':'employment-law','employee benefits':'employment-law','employee benefit':'employment-law','employee benefits law':'employment-law','employment benefits law':'employment-law','employment and employee benefits':'employment-law'};return practiceAreas.find(a=>a.name.toLowerCase()===q||a.id.replace(/-/g,' ')===q||a.id===aliases[q]);}
