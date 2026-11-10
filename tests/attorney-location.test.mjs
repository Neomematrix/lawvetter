import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const states=fs.readFileSync('app/us-states.ts','utf8');
const source=states+fs.readFileSync('app/attorney-location.ts','utf8').replace("import {usStates} from './us-states';",'');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {requireAttorneyLocation}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('Lawyer location rejects missing, whitespace and placeholder cities and missing or invalid states',()=>{
 for(const city of [undefined,null,'','   ','City not listed','N/A'])assert.throws(()=>requireAttorneyLocation(city,'NY'),/city/);
 for(const state of [undefined,null,'','  ','XX','New York'])assert.throws(()=>requireAttorneyLocation('New York',state),/state/);
 for(const [city,state] of [['New York','NY'],[' Atlanta ','ga'],['San Juan','PR']])assert.doesNotThrow(()=>requireAttorneyLocation(city,state));
});
