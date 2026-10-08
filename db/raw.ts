import { env } from 'cloudflare:workers';
export function rawDb() {
 if (!env.DB) throw new Error('Attorney database unavailable');
 return env.DB;
}
