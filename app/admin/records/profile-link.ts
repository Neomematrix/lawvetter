import {attorneyPath} from '../../seo';
// Use the current public ID directly. A legacy license URL may have an old
// permanent redirect cached from before the attorney was deleted and re-added.
export function adminAttorneyPath(row:Record<string,string|number|null|undefined>){
 const id=String(row.bar_number||row._id||''),publicId=String(row.public_id||row._publicId||'');
 return publicId?attorneyPath({bar_number:id,name:String(row.name||''),public_id:publicId}):'/attorney?bar='+encodeURIComponent(id)+'&source=admin';
}
