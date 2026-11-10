import {attorneyFirmSettings} from './submitted-firm';
import {publicRecords} from './public-records';
import {GET as reviewsGET} from '../app/api/client-reviews/route';
import type {ClientReviewPage} from '../app/ClientReviews';
import {GET} from '../app/api/attorneys/route';
import {rawDb} from './raw';
import type {ProfileState} from '../app/ClaimProfile';
export async function publicDirectory<T>(parameters:Record<string,string|number>) {
 const url=new URL('https://lawvetter.local/api/attorneys');for(const [key,value] of Object.entries(parameters))url.searchParams.set(key,String(value));
 const response=await GET(new Request(url)),data=await response.json() as T&{error?:string};
 if(!response.ok){const error=Object.assign(Error(data.error||'Directory unavailable.'),{status:response.status});throw error;}return data;
}
export async function publicProfileState(bar:string):Promise<ProfileState>{
 const db=rawDb();const [profile,firm]=await Promise.all([
  db.prepare('SELECT bar_number,languages,headline,bio,practice_areas,website,linkedin_url,photo_key,claimed_at,updated_at FROM attorney_profiles WHERE bar_number=?').bind(bar).first<NonNullable<ProfileState['profile']>>(),
  attorneyFirmSettings(bar)
 ]);return {profile:await publicRecords(profile),firmWebsite:firm?.website??null,firmLinkedInUrl:firm?.linkedin_url??null,isOwner:false,claim:null,signedIn:false,isAdmin:false};
}

export async function publicReviews(bar:string):Promise<ClientReviewPage>{const r=await reviewsGET(new Request('https://lawvetter.local/api/client-reviews?bar='+encodeURIComponent(bar)));if(!r.ok)throw Error('Reviews unavailable.');return await r.json() as ClientReviewPage;}
