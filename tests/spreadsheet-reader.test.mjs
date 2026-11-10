import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';

async function reader(readSheet,timers={setTimeout,clearTimeout}){
 const context=vm.createContext({Blob,Uint8Array,Promise,Error,...timers});
 const code=ts.transpileModule(fs.readFileSync('app/admin/import/spreadsheet-reader.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const m=new vm.SourceTextModule(code,{context});
 await m.link(spec=>{const exports=spec==='fflate'?{unzipSync,zipSync}:{readSheet};return new vm.SyntheticModule(Object.keys(exports),function(){for(const[k,v]of Object.entries(exports))this.setExport(k,v)},{context});});
 await m.evaluate();return m.namespace.readSpreadsheet;
}
test('The reader removes worker-dependent ZIP compression while preserving all worksheet XML',async()=>{
 const original={'xl/worksheets/sheet1.xml':strToU8('<worksheet><cell>03204, José, &amp; Jane</cell></worksheet>'),'xl/styles.xml':strToU8('<styleSheet>date formats</styleSheet>'),'xl/sharedStrings.xml':strToU8('<sst>original strings</sst>'),'xl/media/photo.png':new Uint8Array([1,2,3])};
 const read=await reader(async(input,sheet,options)=>{
  assert.equal(sheet,1);assert.equal(options.parseNumber('00123'),'00123');
  const files=unzipSync(new Uint8Array(input),{filter:entry=>{assert.equal(entry.compression,0);return true;}});
  for(const name of Object.keys(original).filter(name=>name.endsWith('.xml')))assert.equal(strFromU8(files[name]),strFromU8(original[name]));
  assert.equal(files['xl/media/photo.png'],undefined);
  return [['Attorney name','ZIP code'],['Example Attorney','03204']];
 });
 const rows=await read(new Blob([zipSync(original,{level:9})]));assert.equal(rows[1][1],'03204');
});
test('A stalled library call times out with a usable CSV recovery message',async()=>{
 let cleared=false;
 const read=await reader(()=>new Promise(()=>{}),{setTimeout:fn=>setTimeout(fn,1),clearTimeout:id=>{cleared=true;clearTimeout(id);}});
 await assert.rejects(read(new Blob([zipSync({'xl/workbook.xml':strToU8('<workbook/>')})])),/Please use the CSV version/);
 assert.equal(cleared,true);
});
