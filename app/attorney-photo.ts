// Photograph supplied by the site owner for Matthew Clinton Hines, GA #356082.
const suppliedPhotos:Record<string,string>={'356082':'/attorneys/matthew-c-hines.png'};
export function attorneyPhoto(bar:string,ownerPhoto?:string|null){return ownerPhoto?'/api/profile-photo?bar='+encodeURIComponent(bar)+'&v='+encodeURIComponent(ownerPhoto):suppliedPhotos[bar];}
