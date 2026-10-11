export async function profileRequest<T>(data:Record<string,unknown>):Promise<T>{
 const response=await fetch('/api/profiles',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data)});
 if(!response.headers.get('Content-Type')?.includes('application/json'))throw new Error('Reopen LawVetter and sign in to manage your profile.');
 const result=await response.json() as T&{error?:string};if(!response.ok)throw new Error(result.error||'Profile service unavailable.');return result;
}
