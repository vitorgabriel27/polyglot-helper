"""Explicit offline-model setup. Downloads weights only; no text or audio is uploaded."""
import hashlib
import json
import shutil
import urllib.request
import zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((Path(__file__).parent / 'model.json').read_text())
package = ROOT / '.models' / (manifest['id'] + '.argosmodel')
package.parent.mkdir(exist_ok=True)
if not package.is_file():
    temporary = package.with_suffix('.download')
    for url in manifest['urls']:
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'PolyglotHelper setup/0.1'})
            with urllib.request.urlopen(request, timeout=30) as source, temporary.open('wb') as target:
                shutil.copyfileobj(source, target)
            temporary.replace(package)
            break
        except Exception:
            temporary.unlink(missing_ok=True)
    else:
        raise RuntimeError('Translation model download failed')
with package.open('rb') as stream:
    if hashlib.file_digest(stream, 'sha256').hexdigest() != manifest['sha256']:
        raise RuntimeError('Translation model integrity check failed')
target = ROOT / '.models' / manifest['id']
with zipfile.ZipFile(package) as archive:
    for relative in manifest['files']:
        source_name = manifest['id'] + '/' + relative
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(source_name) as source, destination.open('wb') as output:
            shutil.copyfileobj(source, output)
print('Tradução local inglês → português brasileiro preparada. Nenhum texto ou áudio foi enviado.')
