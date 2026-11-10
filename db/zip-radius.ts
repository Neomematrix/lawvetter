import coordinates from '../data/us-zip-coordinates.json';
import {searchRadius} from '../app/search-radius';
const locations:Record<string,number[]>=coordinates;
const radians=(degrees:number)=>degrees*Math.PI/180;
export function distanceMiles(a:readonly number[],b:readonly number[]):number {
 const lat=radians(b[0]-a[0]),lon=radians(b[1]-a[1]);
 const h=Math.sin(lat/2)**2+Math.cos(radians(a[0]))*Math.cos(radians(b[0]))*Math.sin(lon/2)**2;
 return 3958.7613*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function zipRadius(zip:string,radius:unknown=50):Record<string,number> {
 if(!/^\d{5}(?:-\d{4})?$/.test(zip))throw Error('Enter a valid 5 digit ZIP code.');
 const origin=locations[zip.slice(0,5)];
 if(!origin)throw Error('This ZIP code could not be located. Try a nearby ZIP code.');
 const miles=searchRadius(radius),nearby:Record<string,number>={};
 for(const [code,point] of Object.entries(locations)){
  if(miles!==-1&&Math.abs(point[0]-origin[0])>miles/68)continue;
  const distance=distanceMiles(origin,point);
  if(miles===-1||distance<=miles)nearby[code]=distance;
 }
 return nearby;
}
