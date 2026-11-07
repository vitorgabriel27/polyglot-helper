"""Explicit setup downloads model weights only; never opens or uploads user audio."""
import hashlib
import json
import os
from pathlib import Path
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['HF_HUB_DISABLE_XET'] = '1'
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((Path(__file__).parent / 'model.json').read_text())
target = ROOT / '.models' / manifest['id']
snapshot_download(repo_id=manifest['repository'], revision=manifest['revision'],
                  local_dir=str(target), allow_patterns=manifest['files'], token=False)
with (target / 'model.bin').open('rb') as stream:
    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
if digest != manifest['modelSha256']:
    raise RuntimeError('Model integrity check failed')
print('ASR local preparado: base.en, CPU/int8. Nenhum áudio foi enviado.')
