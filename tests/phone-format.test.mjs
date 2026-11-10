import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
const code=ts.transpileModule(fs.readFileSync('app/phone-format.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const mod=new vm.SourceTextModule(code);await mod.link(()=>assert.fail('No runtime dependencies expected'));await mod.evaluate();
const {formatPhoneInput,formatPhoneEvent}=mod.namespace;
test('Phone entry adds hyphens while typing and normalizes pasted US numbers',()=>{
 for(const [input,expected] of [['',''],['3','3'],['307','307'],['3077','307-7'],['307733','307-733'],['3077335','307-733-5'],['3077335130','307-733-5130'],['(307) 733-5130','307-733-5130'],['307.733.5130','307-733-5130'],['1 307 733 5130','307-733-5130'],['+1 (307) 733-5130','+1-307-733-5130']])assert.equal(formatPhoneInput(input),expected,input);
 for(const value of ['+44 20 7946 0958','123456789012345','307-733-5130 ext 123','call me'])assert.equal(formatPhoneInput(value),value,'Never silently discard unsupported digits or text');
});
test('Phone formatting preserves editing position and submits the formatted value',()=>{
 const dom=new JSDOM('<form><input name="phone" type="tel"></form>'),input=dom.window.document.querySelector('input');
 input.value='3077335';input.setSelectionRange(7,7);formatPhoneEvent({currentTarget:input});assert.equal(input.value,'307-733-5');assert.equal(input.selectionStart,9);
 input.value='307733-5130';input.setSelectionRange(3,3);formatPhoneEvent({currentTarget:input});assert.equal(input.value,'307-733-5130');assert.equal(input.selectionStart,3);
 assert.equal(new dom.window.FormData(dom.window.document.querySelector('form')).get('phone'),'307-733-5130');dom.window.close();
});
