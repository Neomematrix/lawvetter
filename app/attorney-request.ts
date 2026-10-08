export async function requestAttorneyData<T>(parameters: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
 let response: Response;
 try {
  response = await fetch('/api/attorneys', {
   method: 'POST', credentials: 'include', redirect: 'error', cache: 'no-store',
   headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
   body: JSON.stringify(parameters), signal,
  });
 } catch (error) {
  if (error instanceof Error && error.name === 'AbortError') throw error;
  throw new Error('Search could not connect. Reopen CounselCheck and try again.');
 }
 if (!response.headers.get('Content-Type')?.includes('application/json')) {
  throw new Error('Search could not connect. Reopen CounselCheck and try again.');
 }
 const data = await response.json() as T & {error?: string};
 if (!response.ok) throw new Error(data.error || 'Attorney records are temporarily unavailable. Please try again.');
 return data;
}
