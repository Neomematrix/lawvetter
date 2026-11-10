import type {PhotoFrameDraft} from '../../PhotoFrameEditor';
type Row=Record<string,string|number|null>;
export type RecordDraft={kind:string;q:string;city:string;state:string;page:number;sort:string;editorKind:string;edit:Row|null;parentFirm:Row|null;photoFile:File|null;firmFile:File|null;parentFirmFile:File|null;photoFrame:PhotoFrameDraft|null;scroll:number};
let memory:RecordDraft|null|undefined;
let timer:ReturnType<typeof setTimeout>|undefined;
let pending=Promise.resolve();
const tokenKey='lawvetter-admin-draft-tab';
function tabKey(){try{let key=sessionStorage.getItem(tokenKey);if(!key){key=Date.now()+'-'+Math.random().toString(36).slice(2);sessionStorage.setItem(tokenKey,key);}return key;}catch{return null;}}
async function database(){if(typeof indexedDB==='undefined')return null;return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('lawvetter-admin-drafts',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function readAdminDraft():Promise<RecordDraft|null>{
 if(memory!==undefined)return memory;
 const key=tabKey();if(!key)return null;
 try{const db=await database();if(!db)return null;const value=await new Promise<RecordDraft|null>((resolve,reject)=>{const request=db.transaction('drafts').objectStore('drafts').get(key);request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);});db.close();if(memory===undefined)memory=value;return memory??null;}catch{return null;}
}
export function flushAdminDraft(){
 clearTimeout(timer);const value=memory,key=tabKey();if(value===undefined||!key)return;
 pending=pending.then(async()=>{const db=await database();if(!db)return;try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts');if(value)store.put(value,key);else store.delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}).catch(()=>{});
}
export function writeAdminDraft(value:RecordDraft|null){memory=value;clearTimeout(timer);timer=setTimeout(flushAdminDraft,150);}
export function clearAdminDraft(){writeAdminDraft(null);flushAdminDraft();}
