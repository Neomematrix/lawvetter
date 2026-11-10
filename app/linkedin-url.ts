export function linkedInUrl(value:unknown,kind:'attorney'|'firm'){
 if(value===undefined||value===null)return undefined;
 if(typeof value!=='string'||value.length>500)throw Error('Enter a LinkedIn URL of 500 characters or fewer.');
 const text=value.trim();if(!text)return '';
 let url:URL;try{url=new URL(text);}catch{throw Error('Enter a complete HTTPS LinkedIn URL.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!(url.hostname==='linkedin.com'||url.hostname.endsWith('.linkedin.com'))||!new RegExp(kind==='attorney'?'^/in/[^/]+/?$':'^/company/[^/]+/?$').test(url.pathname))throw Error(kind==='attorney'?'Use your LinkedIn profile link: https://www.linkedin.com/in/your-name/':'Use the firm LinkedIn page: https://www.linkedin.com/company/your-firm/');
 return 'https://www.linkedin.com'+url.pathname.replace(/\/$/,'')+'/';
}
