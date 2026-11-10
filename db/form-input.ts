/** Public plain-text fields accept punctuation, never executable markup or control characters.
 * SQL safety comes from bound parameters, not keyword filtering. */
export function invalidPlainText(data:Record<string,unknown>,fields:string[]){
 return fields.some(key=>data[key]!==undefined&&(typeof data[key]!=='string'||/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]|<\s*\/?\s*[a-z!][^>]*>/i.test(data[key] as string)));
}
