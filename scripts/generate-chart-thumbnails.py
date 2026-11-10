"""Refresh small public chart avatars without changing profile originals.
Run from the repository root after new public chart portraits are added.
Only the public charts API and revisioned public photos are read.
"""
import hashlib, io, json, re, subprocess
from pathlib import Path
from PIL import Image, ImageOps
from concurrent.futures import ThreadPoolExecutor
ORIGIN = 'https://www.lawvetter.com'

def read(path):
    return subprocess.check_output(['curl','--location','--proto','=https','--proto-redir','=https','--fail','--silent','--show-error','--retry','2','--max-time','45',ORIGIN + path])

def main():
    data = json.loads(read('/api/attorneys?home=1'))
    sources = {}
    for key in ('weekly','monthly','ratedAll','ratedWeekly','ratedMonthly'):
        for row in data.get(key, []):
            bar, revision = row.get('bar_number',''), (row.get('photo_key') or '')
            if re.fullmatch(r'LV[0-9a-f]{32}', bar) and re.fullmatch(r'p[0-9a-f]+', revision):
                sources[bar + '.' + revision] = '/api/profile-photo?bar=' + bar + '&v=' + revision
    output = Path('public/chart-avatars'); output.mkdir(parents=True, exist_ok=True)
    def convert(item):
        key, path = item
        original = read(path)
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(original)))
        variants = []
        for edge, suffix in ((192,''),(320,'@3x')):
            resized = image.copy(); resized.thumbnail((edge,edge), Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            resized.save(buffer, 'WEBP', quality=92, method=6, icc_profile=image.info.get('icc_profile',b''))
            thumb = buffer.getvalue()
            name = hashlib.sha256(thumb).hexdigest()[:16] + '.webp'
            (output / name).write_bytes(thumb)
            variants.append((key+suffix, '/chart-avatars/'+name, len(thumb)))
        return len(original), variants
    rows = list(ThreadPoolExecutor(max_workers=4).map(convert, sorted(sources.items())))
    placeholder = Image.open('public/attorneys/placeholder.73de70770474.webp')
    placeholder.thumbnail((160,160), Image.Resampling.LANCZOS)
    buffer = io.BytesIO(); placeholder.save(buffer,'WEBP',lossless=True,method=6)
    thumb = buffer.getvalue(); name = hashlib.sha256(thumb).hexdigest()[:16] + '.webp'
    (output / name).write_bytes(thumb)
    manifest = {key:path for _,variants in rows for key,path,_ in variants}
    manifest['placeholder'] = '/chart-avatars/' + name
    Path('worker/chart-avatar-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    used={path.rsplit('/',1)[1] for path in manifest.values()}
    for old in output.glob('*.webp'):
        if old.name not in used: old.unlink()
    print(json.dumps({'portraits':len(rows),'sourceBytes':sum(r[0] for r in rows),'standardThumbnailBytes':sum(r[1][0][2] for r in rows),'highDensityThumbnailBytes':sum(r[1][1][2] for r in rows),'placeholderBytes':len(thumb)}))

if __name__ == '__main__': main()
