export async function clientReviewRequest<T=unknown>(body:Record<string,unknown>,evidence?:File|null):Promise<T>{
 const form=evidence?new FormData():null;if(form){form.set('data',JSON.stringify(body));form.set('photo',evidence!);}
 const headers:Record<string,string>={Accept:'application/json'};if(!form)headers['Content-Type']='application/json';
 let r:Response;try{r=await fetch('/api/client-reviews',{method:'POST',credentials:'include',headers,body:form||JSON.stringify(body)});}catch{throw new Error('Your request could not reach LawVetter. Your entries are still here. Check your connection and try submitting again.');}
 const text=await r.text();let data:T&{error?:string};
 try{data=JSON.parse(text);}catch{throw new Error(r.status===413?'The uploaded file is too large. Choose a PDF, JPG, or PNG up to 20 MB.':r.status===401?'Your session expired. Log in again before submitting.':'LawVetter returned an unexpected response. Your entries are still here. Please try submitting again.');}
 if(!r.ok)throw new Error(data?.error||'Unable to complete the request. Please try again.');return data;
}
import type {ReviewRatings} from './review-ratings';
export type ClientRequest=ReviewRatings&{evidence_name?:string;id:string;bar_number:string;attorney_name:string;attorney_photo_key?:string|null;legal_name:string;public_author?:string;court:string;county:string;state:string;opposing_party:string;document_name:string;document_date:string;party_role:string;representation_start:string;representation_end:string;request_notes:string;docket:string;status:string;decision_note:string;review_draft:string;review_status:string;review_revision:string;review_decision_note:string;review_body:string;public_mode:string;published_at:string|null};
