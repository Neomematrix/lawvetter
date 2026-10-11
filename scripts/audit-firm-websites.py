"""Audit every imported affiliation; publish only corroborated official websites.

Email domains are discovery hints, not evidence that a website belongs to a firm.
Require the firm's distinctive name in the website's own title/brand metadata,
legal-practice content, and no parking/marketplace indicators. Cache remote reads
outside the repository; retain concise provenance and unresolved records.
"""
import concurrent.futures, collections, datetime, hashlib, html, json, os, pathlib, re, urllib.request, urllib.parse
from html.parser import HTMLParser

ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=pathlib.Path(os.environ.get('FIRM_AUDIT_CACHE','/workspace/firm-website-cache'))
CACHE.mkdir(exist_ok=True)
CHECKED=datetime.datetime.now(datetime.timezone.utc).isoformat()
PERSONAL=set('gmail.com yahoo.com ymail.com rocketmail.com aol.com hotmail.com outlook.com live.com msn.com icloud.com me.com mac.com bellsouth.net att.net comcast.net earthlink.net mindspring.com charter.net windstream.net verizon.net sbcglobal.net juno.com mail.com proton.me protonmail.com yahoo.co.uk yahoo.ca hotmail.co.uk netscape.net netzero.net america.net mac.com attglobal.net usa.net email.com'.split())
STOP=set('the law laws office offices of and at attorney attorneys lawyer lawyers legal group firm llc llp lp pc pa pllc inc incorporated p c l l limited liability partnership professional corporation company partners associates esq esquire jr sr iii ii iv us usa'.split())
GENERIC=set('attorneyatlaw retired selfemployed none na privatepractice solepractitioner solo practitioner'.split())
def key(s):
 s=s.strip().lower().replace('&','and')
 return re.sub(r"[\s.,\-'’/()]",'',s)
def words(s):return [w for w in re.findall('[a-z]+',s.lower()) if len(w)>1 and w not in STOP]
def compact(s):return re.sub('[^a-z0-9]','',s.lower())
class Page(HTMLParser):
 def __init__(self):
  super().__init__();self.title='';self.brand=[];self.text=[];self.links=[];self.skip=0;self.intitle=False;self.current=None
 def handle_starttag(self,t,a):
  a=dict(a)
  if t in ('script','style','noscript'):self.skip+=1
  if t=='title':self.intitle=True
  if t=='meta' and a.get('property',a.get('name','')).lower() in ('og:site_name','og:title','twitter:title','description','og:description'):self.brand.append(a.get('content',''))
  if t=='img' and 'logo' in a.get('alt','').lower():self.brand.append(a['alt'])
  if t=='a':self.current=[a.get('href',''),a.get('aria-label','')+' '+a.get('title','')]
 def handle_endtag(self,t):
  if t in ('script','style','noscript'):self.skip=max(0,self.skip-1)
  if t=='title':self.intitle=False
  if t=='a' and self.current:self.links.append(self.current);self.current=None
 def handle_data(self,d):
  if self.skip:return
  if self.intitle:self.title+=d
  self.text.append(d)
  if self.current:self.current[1]+=' '+d
def fetch(domain):
 f=CACHE/(hashlib.sha256(domain.encode()).hexdigest()+'.json')
 if f.exists():
  try:return json.loads(f.read_text())
  except json.JSONDecodeError:pass
 if os.environ.get('FIRM_AUDIT_CACHE_ONLY')=='1':return {'domain':domain,'status':'not-checked'}
 result={'domain':domain,'status':'unreachable'}
 for host in [domain] + ([] if domain.startswith('www.') else ['www.'+domain]):
  try:
   req=urllib.request.Request('https://'+host+'/',headers={'User-Agent':'Mozilla/5.0 (compatible; LawVetter directory verification)'})
   with urllib.request.urlopen(req,timeout=9) as r:
    if 'html' not in r.headers.get('Content-Type','').lower():result['status']='not-html';break
    raw=r.read(650000).decode('utf-8','replace');url=r.url
   p=Page();p.feed(raw)
   result={'domain':domain,'status':'fetched','url':url,'title':p.title,'brand':' '.join([p.title]+p.brand),'text':re.sub(r'\s+',' ',' '.join(p.text)),'links':p.links,'checked':CHECKED};break
  except Exception as e:result['error']=type(e).__name__
 temp=f.with_suffix('.tmp');temp.write_text(json.dumps(result));temp.replace(f);return result
def verify(name,page):
 if page.get('status')!='fetched':return False
 text=page['text'].lower();brand=compact(page['brand']);tokens=words(name)
 if not tokens or (len(tokens)==1 and len(tokens[0])<6):return False
 if key(name) in GENERIC or key(name)=='morganandmorgan':return False
 if re.search(r'domain (is )?(for sale|parked)|buy this domain|sedo domain|hugedomains|afternic|this website is for sale',text):return False
 if not re.search(r'\b(attorneys?|lawyers?|law firm|legal services|law practice|practice areas|litigation)\b',text):return False
 # All distinctive name components must appear in publisher-controlled branding.
 if not all(t in brand for t in tokens):return False
 # Do not turn a directory, social account, or page at an unrelated service into a firm site.
 host=urllib.parse.urlparse(page['url']).hostname or ''
 if any(host==d or host.endswith('.'+d) for d in ['linkedin.com','facebook.com','avvo.com','justia.com','findlaw.com','superlawyers.com','martindale.com','gabar.org']):return False
 return True
def linkedin(page):
 found=set()
 for href,label in page.get('links',[]):
  p=urllib.parse.urlparse(urllib.parse.urljoin(page.get('url',''),html.unescape(href or '')))
  if (p.hostname or '').lower() in ('linkedin.com','www.linkedin.com') and re.fullmatch(r'/company/[a-zA-Z0-9_%.-]+/?',p.path):found.add('https://www.linkedin.com'+p.path.rstrip('/')+'/')
 return next(iter(found)) if len(found)==1 else ''
def run():
 rows=[json.loads(s) for s in (ROOT/'data/georgia-attorneys.jsonl').open()]
 groups=collections.defaultdict(list)
 for r in rows:
  if r['company']:groups[key(r['company'])].append(r)
 candidates={};domains=collections.Counter()
 for k,rs in groups.items():
  counts=collections.Counter(r['email'].rsplit('@',1)[-1].lower().strip() for r in rs if '@' in r['email'])
  ds=[d for d,n in counts.most_common() if d not in PERSONAL and re.fullmatch(r'[a-z0-9][a-z0-9.-]+\.[a-z]{2,}',d) and not d.endswith(('.gov','.edu','.mil'))][:2]
  candidates[k]=ds
  for d in ds:domains[d]+=len(rs)
 pages={};ordered=sorted(domains,key=lambda d:-domains[d]);print(json.dumps({'records':len(rows),'affiliations':len(groups),'domainsToCheck':len(ordered)}),flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=int(os.environ.get('FIRM_AUDIT_WORKERS','120'))) as pool:
  pending={pool.submit(fetch,d):d for d in ordered}
  for i,f in enumerate(concurrent.futures.as_completed(pending),1):
   d=pending[f]
   try:pages[d]=f.result()
   except Exception:pages[d]={'status':'failed'}
   if i%250==0:print(json.dumps({'domainsChecked':i,'total':len(ordered)}),flush=True)
 verified={};audit=[];personal={}
 for k,rs in groups.items():
  names=list(dict.fromkeys(r['company'] for r in rs));matches=[pages[d] for d in candidates[k] if any(verify(n,pages[d]) for n in names)]
  destinations={urllib.parse.urlparse(m['url']).hostname.removeprefix('www.') for m in matches}
  item={'key':k,'names':names,'attorneys':len(rs),'candidateDomains':candidates[k]}
  if len(destinations)==1:
   m=matches[0];u=urllib.parse.urlparse(m['url']);url=urllib.parse.urlunparse((u.scheme,u.netloc,u.path or '/','','',''))
   if u.scheme!='https':item['status']='needs-review-insecure-redirect'
   else:
    entry={'website':url,'linkedin':linkedin(m),'source':m['url'],'checked':m.get('checked',CHECKED),'evidenceTitle':m['title'][:250],'method':'official-site-brand-and-bar-affiliation'}
    verified[k]=entry;item['status']='verified';item['website']=url
    # Personal accounts require an explicit full-name link from the matched firm page.
    for href,label in m.get('links',[]):
     u=urllib.parse.urlparse(urllib.parse.urljoin(m['url'],href or ''))
     if u.hostname not in ('www.linkedin.com','linkedin.com') or not re.fullmatch(r'/in/[a-zA-Z0-9_%.-]+/?',u.path):continue
     for r in rs:
      ns=words(r['name'])
      if len(ns)>=2 and all(w in compact(label) for w in ns):personal[r['barNumber']]={'url':'https://www.linkedin.com'+u.path.rstrip('/')+'/','source':m['url'],'checked':CHECKED,'name':r['name']}
  else:item['status']='needs-review-conflicting-sites' if len(destinations)>1 else ('needs-research' if not candidates[k] else 'not-corroborated')
  audit.append(item)
 (ROOT/'data/firm-website-audit.json').write_text(json.dumps({'checked':CHECKED,'attorneysAudited':len(rows),'withoutPublishedAffiliation':sum(not r['company'] for r in rows),'affiliations':audit},indent=2))
 (ROOT/'data/verified-firm-websites.json').write_text(json.dumps(verified,indent=2,sort_keys=True))
 (ROOT/'data/verified-attorney-linkedin.json').write_text(json.dumps(personal,indent=2,sort_keys=True))
 (ROOT/'app/audited-contacts.ts').write_text('// Verified official contacts; provenance in data/verified-firm-websites.json.\nexport const auditedFirmContacts:Record<string,{website:string;linkedin:string}>='+json.dumps({k:{'website':v['website'],'linkedin':v['linkedin']} for k,v in verified.items()},sort_keys=True)+';\nexport const auditedAttorneyLinkedIn:Record<string,string>='+json.dumps({k:v['url'] for k,v in personal.items()},sort_keys=True)+';\n')
 print(json.dumps({'verifiedFirmNames':len(verified),'attorneysCovered':sum(len(groups[k]) for k in verified),'firmLinkedIn':sum(bool(x['linkedin']) for x in verified.values()),'personalLinkedIn':len(personal),'statuses':dict(collections.Counter(a['status'] for a in audit))}),flush=True)
if __name__=='__main__':run()
