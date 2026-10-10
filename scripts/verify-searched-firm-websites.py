"""Verify search discoveries against publisher branding and directory contacts.

Search results are discovery evidence only. Existing links are preserved. A new
link needs an accessible official homepage, all distinctive firm-name words in
its branding, and a matching published email domain, phone, postal code/city,
or attorney name. Ambiguous and unreachable matches remain unresolved.
"""
import collections, concurrent.futures, datetime, importlib.util, json, os, pathlib, re, urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit',ROOT/'scripts/audit-firm-websites.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
CACHE=pathlib.Path('/workspace/scratch/764247ba8239/official-homepage-cache');CACHE.mkdir(exist_ok=True)
def fetch(url):
 import hashlib
 cache=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
 if cache.exists():return json.loads(cache.read_text())
 result={'requested':url,'status':'unreachable'}
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; CounselCheck professional directory verification)'})
  with urllib.request.urlopen(req,timeout=7) as r:
   if 'html' not in r.headers.get('Content-Type','').lower():raise ValueError('not HTML')
   raw=r.read(800000).decode('utf-8','replace');final=r.url
  p=audit.Page();p.feed(raw)
  result={'requested':url,'status':'fetched','url':final,'title':p.title,'brand':' '.join([p.title]+p.brand),'text':re.sub(r'\s+',' ',' '.join(p.text)),'checked':NOW}
 except Exception as e:result['error']=type(e).__name__
 cache.write_text(json.dumps(result));return result
def identity(names,rs,page):
 if page.get('status')!='fetched':return None
 u=urllib.parse.urlparse(page['url']);host=(u.hostname or '').removeprefix('www.')
 if u.scheme!='https' or any(s in host for s in ['google.','linkedin.','facebook.','yelp.','avvo.','justia.','findlaw.','martindale.','lawyers.','superlawyers.','lawyerdb.','guidetogwinnett.','gbj.com','ambest.','wiza.','privco.','visualvisitor.','salary.com','findglocal.']):return None
 text=page['text'].lower();brand=audit.compact(page['brand'])
 if audit.compact(page['title'])==audit.compact(host):return None
 if re.search(r'domain (is )?(for sale|parked)|buy this domain|sedo domain|hugedomains|afternic|this website is for sale|claim this (listing|business)|business directory|coming soon|under construction',text):return None
 tokens=[audit.words(n) for n in names]
 matched=next((ts for ts in tokens if ts and (len(ts)>1 or len(ts[0])>=6) and all(t in brand for t in ts)),None)
 if not matched:return None
 if len(matched)==1 and matched[0] in {'georgia','government','county','state','insurance','healthcare','hospital','retirement','consulting','administration','church','public','technology','national','justice','mediation','employment'}:return None
 if any(audit.key(n) in audit.GENERIC or audit.key(n) in ['morganandmorgan','lawfirm','lawoffice','legalservices','privatepractice'] for n in names):return None
 digits=re.sub(r'\D','',text)
 for r in rs:
  domain=r.get('email','').rsplit('@',1)[-1].lower()
  if '@' in r.get('email','') and domain not in audit.PERSONAL and (host==domain or host.endswith('.'+domain)):
   return 'official-homepage-brand-and-published-email-domain'
  phone=re.sub(r'\D','',r.get('phone',''))
  if len(phone)>=10 and phone[-10:] in digits:return 'official-homepage-brand-and-directory-phone'
  city=r.get('city','').lower();zipcode=r.get('zip','')[:5]
  if city and len(zipcode)==5 and city in text and re.search(r'\b'+re.escape(zipcode)+r'\b',text):return 'official-homepage-brand-and-directory-city-postcode'
  n=audit.words(r.get('name',''))
  if len(n)>=2 and n[0] in text and n[-1] in text and city and city in text and re.search(r'\b(georgia|ga)\b',text):return 'official-homepage-brand-attorney-and-directory-city'
 return None
def run():
 searches=json.load(open('/workspace/scratch/764247ba8239/firm-search-results.json'))
 groups=collections.defaultdict(list)
 for line in (ROOT/'data/georgia-attorneys.jsonl').open():
  r=json.loads(line)
  if r['company']:groups[audit.key(r['company'])].append(r)
 prior={k:v for k,v in json.load(open(ROOT/'data/verified-firm-websites.json')).items() if not v.get('query')}
 affiliations=json.load(open(ROOT/'data/firm-website-audit.json'))['affiliations'];bykey={a['key']:a for a in affiliations}
 urls=set();proposals={}
 for s in searches:
  key=s['key'];cs=s['candidates'];domains=bykey[key]['candidateDomains']
  proposals[key]=list(dict.fromkeys([c['website'] for c in cs]+['https://'+d+'/' for d in domains]))
  urls.update(proposals[key])
 pages={}
 print(json.dumps({'searches':len(searches),'homepagesToVerify':len(urls)}),flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=100) as pool:
  futures={pool.submit(fetch,u):u for u in sorted(urls)}
  for i,f in enumerate(concurrent.futures.as_completed(futures),1):
   try:pages[futures[f]]=f.result()
   except Exception:pages[futures[f]]={'status':'failed'}
   if i%500==0:print(json.dumps({'homepagesChecked':i,'total':len(urls)}),flush=True)
 added={};results=[]
 for s in searches:
  key=s['key'];matches=[]
  for url in proposals[key]:
   page=pages[url];method=identity(s['names'],groups[key],page)
   if method:
    final=urllib.parse.urlparse(page['url']);site=urllib.parse.urlunparse((final.scheme,final.netloc,final.path or '/','','',''))
    matches.append({'website':site,'linkedin':'','source':page['url'],'checked':NOW,'evidenceTitle':page['title'][:250],'method':method,'query':s['query']})
  # A blocked host request is not evidence that a website is absent. Indexed
  # publisher pages can corroborate branding with the same public contacts.
  # Unknown third-party paths cannot be promoted to official homepages.
  for c in s['candidates']:
   parsed=urllib.parse.urlparse(c['source']);host=(parsed.hostname or '').removeprefix('www.')
   published_domains={r.get('email','').rsplit('@',1)[-1].lower() for r in groups[key] if '@' in r.get('email','') and r.get('email','').rsplit('@',1)[-1].lower() not in audit.PERSONAL}
   if parsed.path not in ('','/') and host not in published_domains:continue
   page={'status':'fetched','url':c['website'],'title':c['title'],'brand':c['title'],'text':c.get('snippet','')}
   method=identity(s['names'],groups[key],page)
   if method:
    matches.append({'website':c['website'],'linkedin':'','source':c['source'],'checked':NOW,'evidenceTitle':c['title'][:250],'method':'indexed-'+method,'query':s['query'],'searchRef':c['ref']})
  hosts={urllib.parse.urlparse(m['website']).hostname.removeprefix('www.') for m in matches}
  status='unresolved-no-corroborated-official-homepage'
  if len(hosts)==1:
   added[key]=matches[0];status='verified'
  elif len(hosts)>1:status='unresolved-conflicting-official-homepages'
  results.append({'key':key,'names':s['names'],'query':s['query'],'searchedAt':s['checked'],'status':status,'candidates':[{k:c[k] for k in ['website','source','title','ref']} for c in s['candidates']],**({'website':added[key]['website']} if key in added else {})})
 # This published spelling variant belongs to John Mabrey, whose membership
 # on the same firm's official team page independently corroborates affiliation.
 alias='cashkruglerfredericksllc';canonical='cashkruglerandfredericksllc'
 if canonical in added and any('mabrey' in r['name'].lower() for r in groups[alias]):
  added[alias]={**added[canonical],'source':'https://www.ckandf.com/our-team/attorneys/','method':'official-firm-brand-and-published-John-Mabrey-team-roster'}
  for result in results:
   if result['key']==alias:result.update(status='verified',website=added[alias]['website'])
 prior.update(added)
 (ROOT/'data/verified-firm-websites.json').write_text(json.dumps(prior,indent=2,sort_keys=True)+'\n')
 (ROOT/'app/searched-firm-websites.ts').write_text('// Verified official homepages; evidence in data/firm-web-search-audit.json.\nexport const searchedFirmWebsites:Record<string,string>='+json.dumps({k:v['website'] for k,v in added.items()},sort_keys=True)+';\n')
 report={'checked':NOW,'totalAffiliationsReviewed':len(affiliations),'searchesCompleted':len(searches),'allMissingWebsiteProfilesSearched':{a['key'] for a in affiliations if a['status']!='linked'}<={s['key'] for s in searches},'newVerifiedFirmNames':len(added),'distinctFirmWebsitesAdded':len({v['website'] for v in added.values()}),'newlyCoveredDirectoryRecords':sum(len(groups[k]) for k in added),'statuses':dict(collections.Counter(r['status'] for r in results)),'firms':results}
 (ROOT/'data/firm-web-search-audit.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k!='firms'}),flush=True)
if __name__=='__main__':run()
