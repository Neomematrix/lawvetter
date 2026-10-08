export function FirmLink({name,eventId}:{name:string;eventId?:string}){
 return <a className="firm-link" href={'/firm?name='+encodeURIComponent(name)+(eventId?'&search='+encodeURIComponent(eventId):'')}>{name}</a>;
}
