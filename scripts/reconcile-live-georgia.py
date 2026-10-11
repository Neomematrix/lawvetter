"""Apply and verify the reviewed Bar delta. Ephemeral credentials arrive on stdin."""
import sys,os,json,pathlib,urllib.request,termios
if os.isatty(sys.stdin.fileno()):
 settings=termios.tcgetattr(sys.stdin.fileno());settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,settings)
print('Ready for private connection settings on stdin.',flush=True)
config=json.loads(input());root=pathlib.Path(__file__).resolve().parents[1]
headers={'Content-Type':'application/json','Authorization':'Bearer '+config['importKey'],'OAI-Sites-Authorization':'Bearer '+config['siteToken']}
def call(path,body=None):
 request=urllib.request.Request(config['url']+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
 with urllib.request.urlopen(request,timeout=90) as r:return json.load(r)
rows={r['barNumber']:r for r in map(json.loads,(root/'data/georgia-attorneys.jsonl').open())}
before=set(call('/api/admin/import')['bars']);delta={r['barNumber']:r for r in json.load((root/'data/georgia-import-delta.json').open())}
missing=set(rows)-before
for b in missing:delta[b]=rows[b]
print(json.dumps({'liveBefore':len(before),'missingFromLive':len(missing),'updatesToApply':len(delta)}),flush=True)
values=list(delta.values())
for start in range(0,len(values),250):
 batch=values[start:start+250];result=call('/api/admin/import',batch)
 if result.get('saved')!=len(batch):raise RuntimeError('Import count mismatch')
after=set(call('/api/admin/import')['bars'])
if set(rows)-after:raise RuntimeError('Live inventory still has missing bar IDs')
if before-after:raise RuntimeError('Unexpected deletion during import')
verified=0
mapping={'barNumber':'bar_number','id':'source_id','admitDate':'admit_date','lawSchool':'law_school','sourceUrl':'source_url','importedAt':'imported_at'}
for r in values:
 actual=call('/api/attorneys?id='+r['barNumber'])['attorney']
 for key,value in r.items():
  if actual.get(mapping.get(key,key))!=value:raise RuntimeError('Field verification failed for '+r['barNumber']+' '+key)
 verified+=1
checks={}
for query in ['Randall M. Kessler','Randall Kessler','Randy Kessler']:
 from urllib.parse import urlencode
 result=call('/api/attorneys?'+urlencode({'q':query,'statusGroup':'active'}));checks[query]=any(r['bar_number']=='004170' for r in result['attorneys'])
 if not checks[query]:raise RuntimeError('Kessler search failed: '+query)
practice=call('/api/attorneys?'+urlencode({'q':'Randall Kessler','practice':'family-law','statusGroup':'active'}))
if not any(a['bar_number']=='004170' for a in practice['attorneys']):raise RuntimeError('Family-law lookup failed')
report={'checked':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'liveBefore':len(before),'liveAfter':len(after),'added':len(after-before),'updatedOrAdded':len(values),'verifiedFieldRecords':verified,'expectedLocalRecords':len(rows),'missingAfter':sorted(set(rows)-after),'preservedExtraLiveRecords':len(after-set(rows)),'searchChecks':checks,'kesslerFamilyLaw':True}
(root/'data/georgia-live-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
