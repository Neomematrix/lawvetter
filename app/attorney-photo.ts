// An opaque revision keeps replacement photos fresh without exposing storage paths.
export function photoRevision(key:string){let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);return 'p'+(hash>>>0).toString(16);}
export function attorneyPhoto(bar:string,ownerPhoto?:string|null){return ownerPhoto?'/api/profile-photo?bar='+encodeURIComponent(bar)+'&v='+encodeURIComponent(/^p[0-9a-f]+$/.test(ownerPhoto)?ownerPhoto:photoRevision(ownerPhoto)):undefined;}
