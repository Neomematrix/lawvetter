'use client';
import type {MouseEvent,ReactNode} from 'react';
export function FirmLink({name,eventId,children}:{name:string;eventId?:string;children?:ReactNode}){
 function rememberOrigin(event:MouseEvent<HTMLAnchorElement>){const url=new URL(event.currentTarget.href);url.searchParams.set('returnTo',window.location.pathname+window.location.search+window.location.hash);event.currentTarget.href=url.pathname+url.search;}
 return <a aria-label={name} className="firm-link" onClick={rememberOrigin} onAuxClick={rememberOrigin} href={'/firm?name='+encodeURIComponent(name)+(eventId?'&search='+encodeURIComponent(eventId):'')}>{children??name}</a>;
}
