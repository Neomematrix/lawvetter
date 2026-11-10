'use client';
import {photoFrameGeometry,photoFramePan} from './photo-frame';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
export type PhotoFrameDraft={file:File;zoom:number;x:number;y:number};
export default function PhotoFrameEditor({onChange,onBusy,disabled=false,staged=false,initialSrc='',initialDraft,onDraftChange}:{initialSrc?:string;initialDraft?:PhotoFrameDraft|null;onDraftChange?:(draft:PhotoFrameDraft|null)=>void;onChange:(file:File|null)=>void;onBusy?:(busy:boolean)=>void;disabled?:boolean;staged?:boolean}){
 const [file,setFile]=useState<File|null>(initialDraft?.file??null),[picture,setPicture]=useState<HTMLImageElement|null>(null),[zoom,setZoom]=useState(initialDraft?.zoom??1),[x,setX]=useState(initialDraft?.x??0),[y,setY]=useState(initialDraft?.y??0),[dragging,setDragging]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState<File|null>(null);
 const [dirty,setDirty]=useState(!!initialDraft),[loading,setLoading]=useState(false),[reload,setReload]=useState(0);
 const draftAtMount=useRef(initialDraft),loadVersion=useRef(0);
 const drag=useRef<{id:number;clientX:number;clientY:number;x:number;y:number}|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null),callbacks=useRef({onChange,onBusy,onDraftChange});callbacks.current={onChange,onBusy,onDraftChange};
 useEffect(()=>{callbacks.current.onDraftChange?.(file&&dirty?{file,zoom,x,y}:null);},[file,zoom,x,y,dirty]);
 useEffect(()=>{
  if(!initialSrc||draftAtMount.current)return;
  const version=++loadVersion.current,controller=new AbortController();setLoading(true);setError('');
  void fetch(initialSrc,{signal:controller.signal,cache:'no-store'}).then(async response=>{
   if(!response.ok)throw Error('Photo unavailable');
   const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Invalid photo');
   if(!controller.signal.aborted&&version===loadVersion.current){setPicture(null);setReady(null);setZoom(1);setX(0);setY(0);setDirty(false);setFile(new File([blob],'saved-profile-photo',{type:blob.type}));}
  }).catch(()=>{if(!controller.signal.aborted&&version===loadVersion.current)setError('The saved photo could not be loaded for editing. You can still save other details or choose a replacement photo.');}).finally(()=>{if(!controller.signal.aborted&&version===loadVersion.current)setLoading(false);});
  return()=>controller.abort();
 },[initialSrc,reload]);
 useEffect(()=>{if(!file){setPicture(null);setReady(null);return;}let active=true;const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{if(active)setPicture(img);};img.onerror=()=>{if(active){setError('This photo could not be opened. Choose another JPEG or PNG.');callbacks.current.onBusy?.(false);}};img.src=url;return()=>{active=false;URL.revokeObjectURL(url);};},[file]);
 useEffect(()=>{if(!picture||!canvas.current)return;let active=true;const c=canvas.current,ctx=c.getContext('2d');if(!ctx)return;setReady(null);callbacks.current.onBusy?.(true);if(staged&&dirty)callbacks.current.onChange(null);
 const {left,top,width,height}=photoFrameGeometry(picture.naturalWidth,picture.naturalHeight,c.width,c.height,false,zoom,x,y);
 ctx.fillStyle='#dceafa';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(picture,left,top,width,height);
 c.toBlob(blob=>{if(!active)return;if(!blob){setError('Unable to prepare this photo. Please choose it again.');callbacks.current.onBusy?.(false);return;}const output=new File([blob],'framed-profile.jpg',{type:'image/jpeg'});setReady(output);if(staged&&dirty)callbacks.current.onChange(output);callbacks.current.onBusy?.(false);},'image/jpeg',.9);return()=>{active=false;};
 },[picture,zoom,x,y,staged,dirty]);
 function choose(next?:File){if(!next)return;if(!['image/jpeg','image/png'].includes(next.type)||next.size>3*1024*1024){setError('Choose a JPEG or PNG smaller than 3 MB.');return;}loadVersion.current++;setLoading(false);setDirty(true);setError('');setZoom(1);setX(0);setY(0);drag.current=null;setDragging(false);setPicture(null);setReady(null);callbacks.current.onChange(null);callbacks.current.onBusy?.(true);setFile(next);}
 function startDrag(event:PointerEvent<HTMLCanvasElement>){
  if(disabled||!picture||event.button!==0||drag.current)return;
  event.preventDefault();setDirty(true);event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={id:event.pointerId,clientX:event.clientX,clientY:event.clientY,x,y};setDragging(true);
 }
 function moveDrag(event:PointerEvent<HTMLCanvasElement>){
  const start=drag.current;if(disabled||!picture||!start||start.id!==event.pointerId)return;
  const c=event.currentTarget,rect=c.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const next=photoFramePan(picture.naturalWidth,picture.naturalHeight,c.width,c.height,zoom,start.x,start.y,(event.clientX-start.clientX)*c.width/rect.width,(event.clientY-start.clientY)*c.height/rect.height);setX(next.x);setY(next.y);
 }
 function endDrag(event:PointerEvent<HTMLCanvasElement>){if(drag.current?.id!==event.pointerId)return;drag.current=null;setDragging(false);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
 function cancel(){draftAtMount.current=null;setDirty(false);setZoom(1);setX(0);setY(0);setReload(v=>v+1);drag.current=null;setDragging(false);setFile(null);setError('');callbacks.current.onChange(null);callbacks.current.onBusy?.(false);}
 return <div className="photo-frame-editor"><label>Choose a profile photo<input type="file" accept="image/jpeg,image/png" disabled={disabled} onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}}/></label>{loading&&<p role="status">Loading saved photo…</p>}{file&&<><p>{file.name}</p><p className="photo-frame-caption">Directory card preview</p><div className="photo-frame-preview"><canvas ref={canvas} width={880} height={800} className={dragging?'is-dragging':''} tabIndex={disabled?-1:0} aria-label="Photo frame. Drag to reposition, or use the arrow keys. Use Zoom to adjust the size." onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={()=>{drag.current=null;setDragging(false);}} onKeyDown={e=>{if(disabled)return;const delta={ArrowLeft:[-.05,0],ArrowRight:[.05,0],ArrowUp:[0,-.05],ArrowDown:[0,.05]}[e.key];if(delta){setDirty(true);e.preventDefault();setX(v=>Math.max(-1,Math.min(1,v+delta[0])));setY(v=>Math.max(-1,Math.min(1,v+delta[1])));}}}/><span className="photo-frame-license" aria-hidden="true">State · Bar number</span></div><p>Drag the photo to position it. Use Zoom to adjust the size.</p><div className="photo-frame-controls"><label>Zoom <output>{zoom.toFixed(1)}×</output><input type="range" min="1" max="4" step="0.05" value={zoom} disabled={disabled} onChange={e=>{setDirty(true);setZoom(Number(e.target.value));}}/></label></div><div className="photo-frame-actions"><button type="button" disabled={disabled} onClick={()=>{setDirty(true);setZoom(1);setX(0);setY(0);drag.current=null;setDragging(false);}}>Reset frame</button><button type="button" disabled={disabled} onClick={cancel}>Cancel photo change</button>{!staged&&<button type="button" disabled={disabled||!ready} onClick={()=>ready&&onChange(ready)}>Save framed photo</button>}</div>{staged&&<p role="status">{ready?(dirty?'Frame ready. Save the form to upload this photo.':'Saved photo loaded. Adjust the zoom or drag to reposition.'):'Preparing photo…'}</p>}</>}{error&&<p role="alert">{error}</p>}</div>;
}
