"""Offline JSON-lines worker. PCM only lives in memory; stdout is a bounded protocol."""
import base64
import json
import os
import sys
import time
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ.setdefault('OMP_NUM_THREADS', '4')
MAX_LINE = 400000
MAX_PCM = 16000 * 2 * 8


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def main():
    try:
        import numpy as np
        from faster_whisper import WhisperModel
        root = Path(__file__).resolve().parents[2]
        directory = root / '.models' / 'base.en'
        if not all((directory / item).is_file() for item in ('model.bin', 'config.json', 'tokenizer.json', 'vocabulary.txt')):
            emit({'type': 'fatal', 'code': 'model_missing'})
            return
        model = WhisperModel(str(directory), device='cpu', compute_type='int8',
                             cpu_threads=4, num_workers=1, local_files_only=True)
    except Exception:
        emit({'type': 'fatal', 'code': 'load_failed'})
        return
    emit({'type': 'ready', 'model': 'base.en', 'device': 'cpu'})
    while True:
        line = sys.stdin.buffer.readline(MAX_LINE + 1)
        if not line:
            return
        if len(line) > MAX_LINE:
            emit({'type': 'fatal', 'code': 'protocol_limit'})
            return
        request_id = None
        try:
            request = json.loads(line)
            request_id = request['id']
            if set(request) != {'id', 'pcm'} or type(request_id) is not int or request_id < 1:
                raise ValueError('protocol')
            pcm = base64.b64decode(request['pcm'], validate=True)
            if not 0 < len(pcm) <= MAX_PCM or len(pcm) % 2:
                raise ValueError('audio')
            audio = np.frombuffer(pcm, dtype='<i2').astype(np.float32) / 32768.0
            started = time.monotonic()
            segments, _ = model.transcribe(audio, language='en', task='transcribe', beam_size=1,
                                          temperature=0, condition_on_previous_text=False,
                                          vad_filter=True, vad_parameters={'min_silence_duration_ms': 300},
                                          max_new_tokens=128)
            text = ' '.join(segment.text.strip() for segment in segments).strip()
            if len(text) > 4096:
                raise ValueError('output')
            emit({'type': 'result', 'id': request_id, 'text': text,
                  'decodeMs': round((time.monotonic() - started) * 1000)})
            del audio, pcm
        except Exception:
            emit({'type': 'error', 'id': request_id, 'code': 'inference_failed'})


if __name__ == '__main__':
    main()
