"""Local CTranslate2 + OPUS model. JSON lines in/out; no network or persisted transcripts."""
import json
import os
import sys
import time
from pathlib import Path
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ.setdefault('OMP_NUM_THREADS', '2')


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def main():
    try:
        import ctranslate2
        import sentencepiece
        directory = Path(__file__).resolve().parents[2] / '.models' / 'translate-en_pb-1_9'
        tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(directory / 'sentencepiece.model'))
        model = ctranslate2.Translator(str(directory / 'model'), device='cpu', compute_type='int8',
                                      intra_threads=2, inter_threads=1)
    except Exception:
        emit({'type': 'fatal', 'code': 'load_failed'})
        return
    emit({'type': 'ready', 'model': 'translate-en_pb-1_9'})
    while True:
        line = sys.stdin.buffer.readline(30001)
        if not line:
            return
        if len(line) > 30000:
            emit({'type': 'fatal', 'code': 'protocol_limit'})
            return
        request_id = None
        try:
            request = json.loads(line)
            request_id = request['id']
            text = request['text']
            if set(request) != {'id', 'text'} or type(request_id) is not int or request_id < 1:
                raise ValueError('protocol')
            if not isinstance(text, str) or not 0 < len(text) <= 4096:
                raise ValueError('text')
            started = time.monotonic()
            tokens = tokenizer.encode(text, out_type=str)
            # Caption windows are short; bounded chunks also handle unexpected long ASR outputs.
            batches = [tokens[index:index + 128] for index in range(0, len(tokens), 128)]
            results = model.translate_batch(batches, beam_size=2, replace_unknowns=True,
                                            max_input_length=128, max_decoding_length=256)
            translated = ' '.join(tokenizer.decode(item.hypotheses[0]).replace('▁', ' ').strip() for item in results).strip()
            if len(translated) > 8192:
                raise ValueError('output')
            emit({'type': 'result', 'id': request_id, 'text': translated,
                  'decodeMs': round((time.monotonic() - started) * 1000)})
            del text, tokens, batches, results, translated
        except Exception:
            emit({'type': 'error', 'id': request_id, 'code': 'translation_failed'})


if __name__ == '__main__':
    main()
