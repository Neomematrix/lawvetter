import {env} from 'cloudflare:workers';
import {createHmac,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {digest} from './client-auth';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes:Uint8Array){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function decode(secret:string){let bits=0,value=0;const out:number[]=[];for(const char of secret){const n=alphabet.indexOf(char);if(n<0)throw Error('Invalid authenticator secret.');value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
export function totp(secret:string,step:number,digits=6){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const h=createHmac('sha1',decode(secret)).update(counter).digest(),offset=h[19]&15,n=(h.readUInt32BE(offset)&0x7fffffff)%(10**digits);return String(n).padStart(digits,'0');}
export function matchingStep(secret:string,code:string,now=Date.now(),lastStep=-1){if(!/^\d{6}$/.test(code))return null;const current=Math.floor(now/30000);for(const step of [current,current-1,current+1]){if(step<=lastStep)continue;if(timingSafeEqual(Buffer.from(totp(secret,step)),Buffer.from(code)))return step;}return null;}
function encryptionKey(){const raw=(env as unknown as {ADMIN_MFA_ENCRYPTION_KEY?:string}).ADMIN_MFA_ENCRYPTION_KEY||'';if(!/^[a-f0-9]{64}$/.test(raw))throw Error('Authenticator encryption is not configured.');return Buffer.from(raw,'hex');}
export function encryptSecret(secret:string,email:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);cipher.setAAD(Buffer.from('lawvetter-admin-mfa:'+email));const body=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return [iv.toString('hex'),cipher.getAuthTag().toString('hex'),body.toString('hex')].join('.');}
export function decryptSecret(encoded:string,email:string){const [iv,tag,body]=encoded.split('.'),cipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'hex'));cipher.setAAD(Buffer.from('lawvetter-admin-mfa:'+email));cipher.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([cipher.update(Buffer.from(body,'hex')),cipher.final()]).toString('utf8');}
export function newSecret(){return base32(randomBytes(20));}
export function recoveryCodes(){return Array.from({length:10},()=>randomBytes(10).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'));}
export function recoveryHash(code:string){return digest('admin-recovery:'+code.replace(/[-\s]/g,'').toUpperCase());}
export function authenticatorUri(secret:string,email:string){return 'otpauth://totp/'+encodeURIComponent('LawVetter:'+email)+'?secret='+secret+'&issuer=LawVetter&algorithm=SHA1&digits=6&period=30';}
