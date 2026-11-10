const requiredFirmFields=[
 ['name','the firm’s full legal name'],['state','the firm’s state'],['city','the firm’s city'],
 ['address','the firm’s street address'],['zip','the firm’s ZIP code'],['county','the firm’s county'],
 ['website','the firm’s website'],['phone','the firm’s phone number']
] as const;
export function requireFirmSubmission(data:Record<string,unknown>){
 for(const [field,label] of requiredFirmFields){if(typeof data[field]!=='string'||!data[field].trim())throw Error('Enter '+label+'.');}
}
