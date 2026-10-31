// A deliberately narrow capability for background research. D1 has no table-level
// roles: this is a code boundary, not a substitute for an isolated database service.
const readable=new Set(['attorneys','attorney_profiles','profile_claims','enrichment_scans','enrichment_jobs','enrichment_receipts','enrichment_evidence','enrichment_proposals','enrichment_firm_assets','enrichment_image_variants']);
const writable=new Set(['enrichment_scans','enrichment_jobs','enrichment_receipts']);
const insertable=new Set([...writable,'enrichment_evidence','enrichment_proposals']);
export function researchDb(database){
 const statements=new WeakMap();
 return {
  prepare(sql){
   if(/;|--|\/\*/.test(sql))throw Error('Research SQL rejected');
   const operation=sql.trim().match(/^(SELECT)\b|^(UPDATE|INSERT(?: OR IGNORE)? INTO)\s+(\w+)/i);
   if(!operation)throw Error('Research operation rejected');
   const verb=(operation[1]||operation[2]).toUpperCase(),table=(operation[3]||'').toLowerCase();
   if(verb==='UPDATE'&&!writable.has(table)||verb.startsWith('INSERT')&&!insertable.has(table))throw Error('Research cannot modify this table');
   for(const match of sql.matchAll(/\b(?:FROM|JOIN|INTO)\s+(\w+)/gi))if(!readable.has(match[1].toLowerCase()))throw Error('Research cannot access unrelated records');
   let statement=database.prepare(sql);
   const wrapped={bind(...args){statement=statement.bind(...args);statements.set(wrapped,statement);return wrapped;},first(){return statement.first();},all(){return statement.all();},run(){return statement.run();}};
   statements.set(wrapped,statement);return wrapped;
  },
  batch(batch){return database.batch(batch.map(s=>{const statement=statements.get(s);if(!statement)throw Error('Unscoped research statement');return statement;}));}
 };
}
