// Photographs supplied by the site owner for the corresponding Georgia Bar profiles.
const suppliedPhotos:Record<string,string>={
 '238455':'/attorneys/brennan-john-mcelhone.png',
 '356082':'/attorneys/matthew-c-hines.png',
};
export function attorneyPhoto(bar:string,ownerPhoto?:string|null){return ownerPhoto?'/api/profile-photo?bar='+encodeURIComponent(bar)+'&v='+encodeURIComponent(ownerPhoto):suppliedPhotos[bar];}
