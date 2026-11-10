import {homeImages} from './home-image-sources';
import {attorneyPhoto,photoRevision} from './attorney-photo';
type Portrait={bar_number:string;photo_key?:string|null};
export function homePortrait(attorney:Portrait,kind:'preview'|'spotlight'|'card'){
 const key=attorney.photo_key,revision=key&&(/^p[0-9a-f]+$/.test(key)?key:photoRevision(key));
 const images=revision?homeImages[attorney.bar_number+'.'+revision]:undefined;
 if(!images)return {src:attorneyPhoto(attorney.bar_number,key)};
 const choices=kind==='preview'?images.slice(0,2):images;
 const sizes=kind==='preview'?'72px':kind==='spotlight'?'(max-width: 700px) 45vw, (max-width: 1000px) 35vw, 400px':'(max-width: 700px) calc(100vw - 108px), 250px';
 return {src:choices[Math.min(2,choices.length-1)].src,srcSet:choices.map(image=>image.src+' '+image.width+'w').join(', '),sizes};
}
