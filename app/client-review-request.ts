export async function clientReviewRequest<T=unknown>(body:Record<string,unknown>):Promise<T>{
 const r=await fetch('/api/client-reviews',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json() as T&{error?:string};if(!r.ok)throw new Error(data.error||'Unable to complete the request.');return data;
}
import type {ReviewRatings} from './review-ratings';
export type ClientRequest=ReviewRatings&{id:string;bar_number:string;attorney_name:string;legal_name:string;court:string;county:string;state:string;opposing_party:string;document_name:string;document_date:string;party_role:string;representation_start:string;representation_end:string;request_notes:string;docket:string;status:string;decision_note:string;review_draft:string;review_status:string;review_revision:string;review_decision_note:string;review_body:string;public_mode:string;published_at:string|null};
