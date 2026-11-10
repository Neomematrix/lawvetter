export function photoFrameGeometry(sourceWidth:number,sourceHeight:number,frameWidth:number,frameHeight:number,fit:boolean,zoom:number,x:number,y:number){
 const scale=(fit?Math.min:Math.max)(frameWidth/sourceWidth,frameHeight/sourceHeight)*zoom;
 const width=sourceWidth*scale,height=sourceHeight*scale;
 return {width,height,left:(frameWidth-width)/2+x*Math.max(0,(width-frameWidth)/2),top:(frameHeight-height)/2+y*Math.max(0,(height-frameHeight)/2)};
}

// Deltas use canvas pixels, so dragging remains precise at any displayed size.
export function photoFramePan(sourceWidth:number,sourceHeight:number,frameWidth:number,frameHeight:number,zoom:number,x:number,y:number,deltaX:number,deltaY:number){
 const {width,height}=photoFrameGeometry(sourceWidth,sourceHeight,frameWidth,frameHeight,false,zoom,0,0);
 const horizontal=Math.max(0,(width-frameWidth)/2),vertical=Math.max(0,(height-frameHeight)/2);
 const clamp=(value:number)=>Math.max(-1,Math.min(1,value));
 return {x:horizontal?clamp(x+deltaX/horizontal):0,y:vertical?clamp(y+deltaY/vertical):0};
}
