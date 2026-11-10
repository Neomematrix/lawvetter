export const firmBannerWidth=1600;
export const firmBannerHeight=533;
export const firmBannerHint='JPEG or PNG · Max 3 MB · Max 1600 × 533 pixels';

// Read encoded dimensions without decoding untrusted uploads into large bitmaps.
export function firmBannerError(bytes:Uint8Array):string{
 let width=0,height=0;
 const u16=(i:number)=>bytes[i]*256+bytes[i+1];
 const u32=(i:number)=>bytes[i]*16777216+bytes[i+1]*65536+bytes[i+2]*256+bytes[i+3];
 if(bytes.length>=33&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&u32(8)===13&&String.fromCharCode(...bytes.slice(12,16))==='IHDR'){
  width=u32(16);height=u32(20);
 }else if(bytes[0]===255&&bytes[1]===216){
  let i=2;
  while(i+3<bytes.length){
   if(bytes[i++]!==255)break;
   while(bytes[i]===255)i++;
   const marker=bytes[i++];
   if(marker===0xd9||marker===0xda)break;
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   const length=u16(i);if(length<2||i+length>bytes.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8){height=u16(i+3);width=u16(i+5);break;}
   i+=length;
  }
 }
 if(!width||!height)return 'Choose a valid JPEG or PNG banner.';
 if(width>firmBannerWidth||height>firmBannerHeight)return `This banner is ${width} × ${height} pixels. The maximum is 1600 × 533 pixels. Resize it before uploading.`;
 return '';
}
