"""Reconcile all Georgia-address Bar entries without deleting user-owned records."""
import json,urllib.request,pathlib,datetime,concurrent.futures,collections,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
def page(skip):
 req=urllib.request.Request(f'https://api.gabar.org/webservices/membersearch?state=GA&skip={skip}&top=1000',data=json.dumps({'state':'GA','skip':str(skip)}).encode(),headers={'Content-Type':'application/json'})
 for attempt in range(3):
  try:
   with urllib.request.urlopen(req,timeout=75) as r:return json.load(r)
  except Exception:
   if attempt==2:raise
   time.sleep(1)
def clean(m,checked):
 visible=not m.get('publish') and m.get('status')!='Deceased' and not m.get('showOnlyEmail')
 row={k:str(m.get(k) or '').strip() for k in ['id','barNumber','city','state','county','status','admitDate','lawSchool']}
 row.update(name=' '.join(str(m.get(k) or '').strip() for k in ['firstName','middleName','lastName','suffix']).strip(),company=str(m.get('company') or '').strip() if visible else '',address=' '.join(str(m.get(k) or '').strip() for k in ['address1','address2']).strip() if visible else '',zip=str(m.get('zip') or '').strip() if visible else '',phone=str(m.get('phone') or '').strip() if visible else '',email=str(m.get('email') or '').strip() if (visible and not m.get('hideEmail')) or m.get('showOnlyEmail') else '',sourceUrl='https://www.gabar.org/member-directory/?id='+m['id'],importedAt=checked)
 return row
def run():
 checked=datetime.datetime.now(datetime.timezone.utc).isoformat();first=page(0);total=int(first['totalRows']);members=list(first['members']);print(json.dumps({'sourceTotal':total}),flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for x in pool.map(page,range(1000,total,1000)):
   if int(x['totalRows'])!=total:raise RuntimeError('Directory changed during scan; retry for a consistent roster')
   members.extend(x['members']);print(json.dumps({'read':len(members),'expected':total}),flush=True)
 current={}
 for m in members:
  r=clean(m,checked)
  if r['state']!='GA' or not r['name'] or not r['barNumber']:raise RuntimeError('Invalid source entry')
  if r['barNumber'] in current:raise RuntimeError('Duplicate source identity; rerun')
  current[r['barNumber']]=r
 if len(current)!=total:raise RuntimeError('Incomplete source roster')
 path=ROOT/'data/georgia-attorneys.jsonl';previous={r['barNumber']:r for r in map(json.loads,path.open())}
 delta=[]
 for b,r in current.items():
  old=previous.get(b)
  if old and all(v==old.get(k) for k,v in r.items() if k!='importedAt'):current[b]=old
  else:delta.append(r)
 missing=sorted(set(current)-set(previous));removed=sorted(set(previous)-set(current))
 # Do not erase departed entries: report them for status/location review.
 merged={**previous,**current}
 path.write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in merged.values()))
 (ROOT/'data/georgia-import-delta.json').write_text(json.dumps(delta,indent=2))
 report={'checkedAt':checked,'scope':'All State Bar directory records with state=GA; includes inactive statuses.','sourceTotal':total,'sourceUnique':len(current),'previousUnique':len(previous),'missingBefore':missing,'updatedOrAdded':len(delta),'absentFromCurrentGeorgiaFilter':removed,'mergedUnique':len(merged),'kessler':current.get('004170')}
 (ROOT/'data/georgia-roster-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
if __name__=='__main__':run()
