// Existing directory records store one full name. Preserve every word when
// opening those records in the separate name fields.
export function splitPersonName(name:string){
 const words=name.trim().split(/\s+/).filter(Boolean);
 if(words.length<2)return {firstName:words[0]||'',middleName:'',lastName:''};
 let last=words.length-1;
 if(/^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(words[last])&&last>1)last--;
 while(last>1&&/^(de|del|della|di|da|dos|das|do|la|las|los|van|von|der|den|st\.?)$/i.test(words[last-1]))last--;
 return {firstName:words[0],middleName:words.slice(1,last).join(' '),lastName:words.slice(last).join(' ')};
}
export function joinPersonName(first:unknown,middle:unknown,last:unknown){return [first,middle,last].map(value=>String(value||'').trim()).filter(Boolean).join(' ');}
