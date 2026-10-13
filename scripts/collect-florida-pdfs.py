"""Extract owner-supplied official Florida Bar result PDFs; no remote scraping."""
import collections,datetime,hashlib,json,pathlib,re,subprocess,sys
from pypdf import PdfReader

def collect(path):
    raw=subprocess.check_output(['pdftotext','-layout',str(path),'-']).decode()
    text=re.sub(r'^.*(?:https://www.floridabar.org/|Find a Florida Bar Lawyer).*$', '',raw,flags=re.M)
    lines=[line.strip().replace('▲','').strip() for line in text.splitlines() if line.strip().replace('▲','').strip()]
    identities=[]
    for i,line in enumerate(lines):
        match=re.fullmatch(r'Bar #(\d+)',line)
        if not match:continue
        start=i-1
        while lines[start].startswith('"'):start-=1
        identities.append((i,start,match[1],lines[start]))
    links=set()
    for page in PdfReader(path).pages:
        for annotation in page.get('/Annots',[]):
            links.add(str(annotation.get_object().get('/A',{}).get('/URI','')))
    rows=[]
    for position,(i,start,bar,name) in enumerate(identities):
        end=identities[position+1][1] if position+1<len(identities) else len(lines)
        body=lines[i+1:end]
        assert body[0]=='Member in Good Standing',(bar,body)
        assert body[1]=='Eligible to Practice Law in Florida',(bar,body)
        source='https://www.floridabar.org/directories/find-mbr/profile/?num='+bar
        assert source in links,(bar,'Missing official profile hyperlink')
        place=next((j for j,line in enumerate(body) if re.fullmatch(r'Miami, FL \d{5}(?:-\d{4})?',line,re.I)),None)
        assert place is not None,(bar,'Missing Miami mailing location')
        address=body[2:place]
        company=''
        if address and not re.match(r'^(\d|PO Box\b|P\.O\.|One\b|Three\b|Suite\b|Ste\b)',address[0],re.I):
            first=address.pop(0)
            normalize=lambda s:re.sub(r'[^a-z]','',s.lower())
            simple=re.sub(r'^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+','',first)
            # Personal addressee lines are not firm affiliations.
            name_words=re.findall(r'[a-z]+',name.lower());personal=all(any(token==word or (len(token)==1 and word.startswith(token)) for word in name_words) for token in re.findall(r'[a-z]+',simple.lower()))
            if not personal and not first.startswith(('Mr.','Ms.','Mrs.','Dr.')):
                company=first
        phone=next((line.removeprefix('Office: ').strip() for line in body if line.startswith('Office: ')),'')
        email=next((line for line in body if re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',line)),'')
        zip_code=body[place].split('FL ',1)[1]
        row=dict(barNumber=bar,id='FL:'+bar,name=name,company=company,city='Miami',state='FL',county='',status='Active Member in Good Standing',admitDate='',lawSchool='',address=' '.join(address),zip=zip_code,phone=phone,email=email,sourceUrl=source,importedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),eligibility='Eligible to Practice Law in Florida',membershipStatus='Member in Good Standing')
        rows.append(row)
    return rows,{'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'records':len(rows),'results':re.findall(r'Showing[^\n]+results\.',raw)[0].strip()}

if __name__=='__main__':
    seen={};sources=[]
    for name in sys.argv[1:]:
        rows,source=collect(pathlib.Path(name));sources.append(source)
        for row in rows:
            previous=seen.get(row['barNumber'])
            if previous:assert previous['name']==row['name'],'Conflicting source identity'
            seen[row['barNumber']]=row
    root=pathlib.Path(__file__).resolve().parents[1]/'data'
    with (root/'florida-miami-attorneys.jsonl').open('w') as file:
        for row in seen.values():file.write(json.dumps(row,ensure_ascii=False)+'\n')
    report={'sourceType':'Owner-supplied official Florida Bar PDFs','sources':sources,'uniqueAttorneys':len(seen),'status':'Member in Good Standing; Eligible to Practice Law in Florida','snapshotDate':'2026-10-12','completeMiamiDirectory':False,'excludedFields':['Cell numbers','Fax numbers'],'omittedResults':'21-100 and 201 onward','collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (root/'florida-miami-import-summary.json').write_text(json.dumps(report,indent=2));print(json.dumps({'records':len(seen),'sources':sources}))
