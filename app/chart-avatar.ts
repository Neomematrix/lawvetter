import {attorneyPhoto,photoRevision} from './attorney-photo';

// Charts need a small portrait, while profile pages retain their original photo.
export function chartAvatar(bar:string,photoKey?:string|null){
 // Preserve the original placeholder's transparent edges and sharp artwork.
 if(!photoKey)return '/attorneys/placeholder.73de70770474.webp';
 if(!/^LV[0-9a-f]{32}$/.test(bar))return attorneyPhoto(bar,photoKey)!;
 const revision=/^p[0-9a-f]+$/.test(photoKey)?photoKey:photoRevision(photoKey);
 return '/api/chart-avatar/'+bar+'.'+revision+'.webp';
}

export function chartAvatarSet(bar:string,photoKey?:string|null){
 const src=chartAvatar(bar,photoKey);
 return src.startsWith('/api/chart-avatar/LV')?src+' 2x, '+src.replace('.webp','@3x.webp')+' 3x':undefined;
}
