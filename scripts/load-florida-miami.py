"""Import and verify the reviewed Miami PDF records; credentials arrive on stdin."""
import json,os,pathlib,sys,termios,urllib.request,urllib.error
if os.isatty(sys.stdin.fileno()):
    settings=termios.tcgetattr(sys.stdin.fileno());settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,settings)
print('Ready for private import settings on stdin.',flush=True)
config=json.loads(input());root=pathlib.Path(__file__).resolve().parents[1]
headers={'Content-Type':'application/json','Authorization':'Bearer '+config['importKey'],'OAI-Sites-Authorization':'Bearer '+config['siteToken']}
def call(path,body=None):
    request=urllib.request.Request(config['url']+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
    with urllib.request.urlopen(request,timeout=40) as response:return json.load(response)
rows=[json.loads(line) for line in (root/'data/florida-miami-attorneys.jsonl').read_text().splitlines()]
before=set(call('/api/admin/import?state=FL')['bars']);ga_before=set(call('/api/admin/import?state=GA')['bars'])
for start in range(0,len(rows),25):
    batch=rows[start:start+25];result=call('/api/admin/import',batch)
    if result.get('saved')!=len(batch):raise RuntimeError('Unexpected import count')
    print(json.dumps({'saved':min(start+25,len(rows)),'expected':len(rows)}),flush=True)
after=set(call('/api/admin/import?state=FL')['bars']);ga_after=set(call('/api/admin/import?state=GA')['bars'])
if ga_before!=ga_after or before-after:raise RuntimeError('An existing directory identity was lost')
for row in rows:
    try:actual=call('/api/attorneys?id=FL:'+row['barNumber'])['attorney']
    except urllib.error.HTTPError as error:
        if error.code!=404:raise
        matches=call('/api/attorneys?q=FL:'+row['barNumber'])['attorneys']
        if len(matches)!=1:raise RuntimeError('Ambiguous legacy Florida identity')
        actual=call('/api/attorneys?id='+matches[0]['bar_number'])['attorney']
    for source,target in [('name','name'),('state','state'),('city','city'),('status','status'),('address','address'),('phone','phone'),('email','email'),('sourceUrl','source_url')]:
        if row[source] and actual.get(target)!=row[source]:raise RuntimeError('Field verification failed: '+row['barNumber']+' '+source)
    if actual.get('license_number')!=row['barNumber']:raise RuntimeError('Florida license identity mismatch')
report={'added':len(after-before),'verifiedRecords':len(rows),'floridaBefore':len(before),'floridaAfter':len(after),'georgiaIdentitiesPreserved':ga_before==ga_after,'snapshotDate':'2026-10-12','completeMiamiDirectory':False}
(root/'data/florida-miami-live-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
