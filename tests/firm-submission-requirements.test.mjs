import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('Firm submissions require all location and contact fields while allowing email and image omission',async()=>{
 const code=ts.transpileModule(fs.readFileSync('app/firm-submission-requirements.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const module=new vm.SourceTextModule(code);await module.link(()=>assert.fail('No dependencies expected'));await module.evaluate();
 const validate=module.namespace.requireFirmSubmission,data={name:'Example Firm',state:'CA',city:'Los Angeles',address:'123 Main Street',zip:'90010',county:'Los Angeles',website:'https://firm.example',phone:'2135550100',publicEmail:'info@firm.example'};
 assert.doesNotThrow(()=>validate(data));
 assert.doesNotThrow(()=>validate({...data,publicEmail:undefined}));
 for(const field of Object.keys(data).filter(field=>field!=='publicEmail')){for(const missing of [undefined,'','   '])assert.throws(()=>validate({...data,[field]:missing}),/Enter /,field+' must be provided');}
 assert.doesNotThrow(()=>validate({...data,publicEmail:''}));
});
