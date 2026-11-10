export default function LinkedInLink({href,label='LinkedIn',iconOnly=false}:{href:string;label?:string;iconOnly?:boolean}){
 return <a className={`linkedin-profile-link${iconOnly?' linkedin-icon-only':''}`} aria-label={iconOnly?label:undefined} title={iconOnly?label:undefined} href={href} target="_blank" rel="noopener noreferrer"><img src="/linkedin.svg" alt="" aria-hidden="true" width="22" height="22"/>{!iconOnly&&<span>{label}</span>}</a>;
}
