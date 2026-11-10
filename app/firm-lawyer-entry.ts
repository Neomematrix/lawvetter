export function firmLawyerEntry(name:string,admin=false,website=''){
 const params=new URLSearchParams(admin?{kind:'attorneys',add:'lawyer',firm:name}:{type:'lawyer',firm:name});
 if(website)params.set('firmWebsite',website);
 return (admin?'/admin/records?':'/add-listing?')+params;
}
export function firmLawyerDefaults(name:unknown,website:unknown){
 const firm=typeof name==='string'?name.trim().slice(0,200):'';
 let firmWebsite='';try{if(typeof website==='string'&&website.length<=2000){const url=new URL(website);if(url.protocol==='https:'&&!url.username&&!url.password)firmWebsite=url.toString();}}catch{}
 return {firm,firmWebsite};
}
