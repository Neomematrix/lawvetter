"""Write sanitized attorney records to CounselCheck; credentials arrive on stdin."""
import json,urllib.request,pathlib,time,concurrent.futures
config=json.loads(input())
path=pathlib.Path(__file__).resolve().parents[1]/'data/georgia-attorneys.jsonl'
rows=[json.loads(line) for line in path.open()]
def save(batch):
 req=urllib.request.Request(config['url']+'/api/admin/import',data=json.dumps(batch).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+config['importKey'],'OAI-Sites-Authorization':'Bearer '+config['siteToken']})
 for attempt in range(3):
  try:
   result=json.load(urllib.request.urlopen(req,timeout=90));break
  except Exception:
   if attempt==2:raise
   time.sleep(2)
 if result.get('saved')!=len(batch):raise RuntimeError('Save count mismatch')
 return len(batch)
count=0
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
 futures=[pool.submit(save,rows[start:start+500]) for start in range(0,len(rows),500)]
 for future in concurrent.futures.as_completed(futures):
  count+=future.result()
  if count%1000==0 or count==len(rows):print(json.dumps({'saved':count,'expected':len(rows)}),flush=True)
print('Import complete',flush=True)
