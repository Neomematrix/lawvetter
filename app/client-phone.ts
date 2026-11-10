export function clientPhone(value:unknown,required=false):string {
 if(value===undefined||value===null||value===''){if(required)throw Error('Enter your phone number.');return '';}
 if(typeof value!=='string')throw Error('Enter a valid phone number.');
 const phone=value.trim(),digits=phone.replace(/\D/g,'');
 if(!phone){if(required)throw Error('Enter your phone number.');return '';}
 if(phone.length>40||!/^\+?[0-9().\- ]+$/.test(phone)||digits.length<7||digits.length>15)throw Error('Enter a valid phone number, including the area code.');
 return phone;
}
