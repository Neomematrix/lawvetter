import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const m=new vm.SourceTextModule(ts.transpileModule(fs.readFileSync('app/photo-frame.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
await m.link(()=>{});await m.evaluate();const geometry=m.namespace.photoFrameGeometry;
test('Full photo fits inside the preview without cutting off tall or wide portraits',()=>{for(const [w,h] of [[600,1500],[1800,600]]){const g=geometry(w,h,880,800,true,1,0,0);assert.ok(g.left>=0&&g.top>=0);assert.ok(g.left+g.width<=880.001&&g.top+g.height<=800.001);}});
test('Fill and zoom cover the frame; pan reaches either edge without exposing empty space',()=>{for(const [w,h] of [[600,1500],[1800,600]])for(const z of [1,2,4])for(const offset of [-1,0,1]){const g=geometry(w,h,880,800,false,z,offset,offset);assert.ok(g.left<=.001&&g.top<=.001);assert.ok(g.left+g.width>=879.999&&g.top+g.height>=799.999);}});

test('Dragging moves the crop by the pointer distance and clamps each edge without empty space',()=>{
 const pan=m.namespace.photoFramePan;
 const moved=pan(600,1500,880,800,2,0,0,120,-70);
 const initial=geometry(600,1500,880,800,false,2,0,0),next=geometry(600,1500,880,800,false,2,moved.x,moved.y);
 assert.ok(Math.abs(next.left-initial.left-120)<.001);assert.ok(Math.abs(next.top-initial.top+70)<.001);
 for(const [w,h] of [[600,1500],[1800,600]])for(const delta of [-10000,10000]){
  const point=pan(w,h,880,800,1,0,0,delta,delta),g=geometry(w,h,880,800,false,1,point.x,point.y);
  assert.ok(g.left<=.001&&g.top<=.001&&g.left+g.width>=879.999&&g.top+g.height>=799.999);
 }
});
