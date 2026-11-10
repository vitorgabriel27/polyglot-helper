"""Explicit offline-model setup. Downloads weights only; no text or audio is uploaded."""
import json
import os
import shutil
import zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((Path(__file__).parent / 'model.json').read_text())
archives = os.environ.get('HELPER_MODEL_ARCHIVES')
package_paths = [Path(item) for item in archives.split(os.pathsep)] if archives else [Path(os.environ.get('HELPER_MODEL_ARCHIVE', ROOT / '.models' / (manifest['id'] + '.argosmodel')))]
model_root = Path(os.environ.get('HELPER_MODEL_DIR', ROOT / '.models'))
model_root.mkdir(parents=True, exist_ok=True)
for package in package_paths:
    if not package.is_file():
        raise RuntimeError('Translation model archive missing')
    with zipfile.ZipFile(package) as archive:
        roots = {name.split('/')[0] for name in archive.namelist() if '/' in name}
        if len(roots) != 1:
            raise RuntimeError('Translation model archive layout invalid')
        root = roots.pop()
        target = model_root / package.stem
        for member in archive.infolist():
            relative = Path(member.filename).relative_to(root)
            destination = (target / relative).resolve()
            if target.resolve() not in destination.parents and destination != target.resolve():
                raise RuntimeError('Unsafe path in translation archive')
            if member.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, destination.open('wb') as output:
                    shutil.copyfileobj(source, output)
print('Modelos locais preparados. Nenhum áudio ou texto do usuário foi enviado.')
