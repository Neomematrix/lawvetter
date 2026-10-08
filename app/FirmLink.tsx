export function FirmLink({name}:{name:string}){
 return <a className="firm-link" href={'/firm?name='+encodeURIComponent(name)}>{name}</a>;
}
