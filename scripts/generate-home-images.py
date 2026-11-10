"""Generate revision-matched public homepage portraits; keep originals intact."""
import hashlib, io, json, re, subprocess
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageOps

ORIGIN='https://www.lawvetter.com'
def read(path):
    return subprocess.check_output(['curl','--location','--proto','=https','--proto-redir','=https','--fail','--silent','--show-error','--retry','2','--max-time','45',ORIGIN+path])

def main():
    data=json.loads(read('/api/attorneys?home=1'));sources={}
    for group in ('popular','weekly','monthly'):
        for row in data.get(group,[]):
            bar,revision=row.get('bar_number',''),row.get('photo_key') or ''
            if re.fullmatch(r'LV[0-9a-f]{32}',bar) and re.fullmatch(r'p[0-9a-f]+',revision):
                sources[bar+'.'+revision]='/api/profile-photo?bar='+bar+'&v='+revision
    output=Path('app/home-images');output.mkdir(exist_ok=True)
    def convert(item):
        key,url=item;original=read(url);image=ImageOps.exif_transpose(Image.open(io.BytesIO(original)))
        variants=[];seen=set()
        for edge in (192,384,640,960):
            resized=image.copy();resized.thumbnail((edge,edge),Image.Resampling.LANCZOS)
            if resized.width in seen:continue
            seen.add(resized.width);buffer=io.BytesIO();resized.save(buffer,'WEBP',quality=92,method=6,icc_profile=image.info.get('icc_profile',b''))
            content=buffer.getvalue();name=hashlib.sha256(content).hexdigest()[:16]+'.webp';(output/name).write_bytes(content)
            variants.append((name,resized.width,len(content)))
        return key,len(original),variants
    rows=list(ThreadPoolExecutor(max_workers=4).map(convert,sorted(sources.items())))
    names=sorted({name for _,_,variants in rows for name,_,_ in variants});ids={name:'image'+str(i) for i,name in enumerate(names)}
    text="import {imageSource} from './home-image-url';\n"+'// Generated from public homepage portraits. Unknown revisions use current originals.\n'
    text+='\n'.join('import '+ids[name]+" from './home-images/"+name+"';" for name in names)+'\n'
    text+='export const homeImages:Record<string,{src:string;width:number}[]>={\n'
    text+='\n'.join(json.dumps(key)+':['+','.join('{src:imageSource('+ids[name]+'),width:'+str(width)+'}' for name,width,_ in variants)+'],' for key,_,variants in rows)+'\n};\n'
    Path('app/home-image-sources.ts').write_text(text)
    # Vite fingerprints imported assets and the existing release asset route
    # provides immutable caching. No new API, cache policy, or shared CSS.
    print(json.dumps({'portraits':len(rows),'originalBytes':sum(size for _,size,_ in rows),'smallBytes':sum(variants[0][2] for _,_,variants in rows),'assets':len(names)}))

if __name__=='__main__':main()
