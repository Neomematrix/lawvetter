// Native, non-passive touchmove is required to cancel Safari page scrolling.
// Decide the gesture once: vertical scrolling and pinch zoom remain available.
export function bindCarouselSwipe(element:HTMLElement,move:(step:number)=>void){
 let start:{x:number;y:number;axis:'x'|'y'|null}|null=null,ignoreClickUntil=0;
 const begin=(event:TouchEvent)=>{start=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY,axis:null}:null;};
 const drag=(event:TouchEvent)=>{
  if(!start||event.touches.length!==1){start=null;return;}
  const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y;
  if(!start.axis&&Math.max(Math.abs(dx),Math.abs(dy))>=8)start.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';
  if(start.axis==='x'&&event.cancelable)event.preventDefault();
 };
 const cancel=()=>{start=null;};
 const end=(event:TouchEvent)=>{
  const gesture=start;start=null;
  if(!gesture||gesture.axis!=='x'||!event.changedTouches.length)return;
  ignoreClickUntil=Date.now()+500;
  const dx=event.changedTouches[0].clientX-gesture.x;
  if(Math.abs(dx)>50)move(dx<0?1:-1);
 };
 const click=(event:MouseEvent)=>{if(Date.now()<ignoreClickUntil){event.preventDefault();event.stopPropagation();}};
 element.addEventListener('touchstart',begin,{passive:true});
 element.addEventListener('touchmove',drag,{passive:false});
 element.addEventListener('touchend',end,{passive:true});
 element.addEventListener('touchcancel',cancel,{passive:true});
 element.addEventListener('click',click,true);
 return ()=>{element.removeEventListener('touchstart',begin);element.removeEventListener('touchmove',drag);element.removeEventListener('touchend',end);element.removeEventListener('touchcancel',cancel);element.removeEventListener('click',click,true);};
}
