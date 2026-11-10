import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync('app/asset-recovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exported={};vm.runInNewContext(source,{exports:exported});
function setup({href='https://www.lawvetter.com/',blocked=false,last=0}={}){
 const handlers={},nodes=[],replacements=[];
 const doc={readyState:'loading',getElementById:id=>nodes.find(n=>n.id===id),createElement:()=>({style:{},setAttribute(){},appendChild(child){this.child=child;}}),body:{appendChild(n){nodes.push(n);}}};
 vm.runInNewContext(exported.assetRecoveryScript,{URL,Date,document:doc,location:{href,replace:url=>replacements.push(url)},sessionStorage:{getItem(){if(blocked)throw Error('blocked');return String(last);},setItem(){if(blocked)throw Error('blocked');}},addEventListener:(name,fn)=>handlers[name]=fn});
 return {handlers,nodes,replacements};
}
test('Module failure waits for document completion before one recovery navigation',()=>{
 const s=setup({blocked:true});
 s.handlers.unhandledrejection({reason:new Error('Importing a module script failed.'),preventDefault(){}});
 assert.equal(s.replacements.length,0);
 s.handlers.DOMContentLoaded();
 assert.equal(s.replacements.length,1);assert.match(s.replacements[0],/_lv_reload=/);
});
test('Repeated asset failure displays a reload link instead of looping',()=>{
 const s=setup({blocked:true,href:'https://www.lawvetter.com/?_lv_reload='+Date.now()});
 s.handlers.error({target:{tagName:'SCRIPT',src:'https://www.lawvetter.com/assets/missing.js'}});
 s.handlers.DOMContentLoaded();
 assert.equal(s.replacements.length,0);assert.equal(s.nodes[0].id,'lawvetter-load-error');assert.equal(s.nodes[0].child.textContent,'Reload page');
});
test('Unrelated third-party errors do not reload the page',()=>{
 const s=setup();s.handlers.error({target:{tagName:'SCRIPT',src:'https://example.com/analytics.js'},message:'Network error'});
 assert.equal(s.replacements.length,0);assert.equal(s.nodes.length,0);
});

test('Recovery preserves entered form data',()=>{
 const s=setup();s.handlers.input();
 s.handlers.unhandledrejection({reason:new Error('Importing a module script failed.'),preventDefault(){}});
 s.handlers.DOMContentLoaded();
 assert.equal(s.replacements.length,0);assert.equal(s.nodes[0].id,'lawvetter-load-error');
});
