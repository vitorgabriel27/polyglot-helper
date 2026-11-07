# Ensaio inicial de transcrição

Protocolo reproduzível para STT-04; valida apenas o baseline local em uma fixture pública. Não satisfaz o aceite de qualidade geral.

## Reprodução

Prepare os modelos com `pnpm setup:asr` e execute `pnpm benchmark:asr`. O script baixa a fixture JFK do repositório whisper.cpp, valida o SHA-256 conhecido, carrega o adaptador de produção `LocalSpeech` e passa PCM ao worker local `base.en` em CPU/int8. Não acessa microfone nem PipeWire. O relatório completo fica em `test-results/benchmark-asr/report-<timestamp>.json`, ignorado pelo Git.

O WAV é mono PCM 16 kHz, 16-bit. O script divide o áudio em blocos sequenciais de até 8 s, conforme o limite atual do worker; calcula WER após concatenar as saídas. WER usa tokens alfanuméricos em minúsculas, preservando contrações. Registra ambiente, hash agregado dos arquivos do modelo, hash da fixture, texto de referência/reconhecido, erros e latência de cada bloco. O tempo inclui ida e volta pelo processo do worker; não inclui captura, segmentação ao vivo ou UI. Inicialização aparece separada. Esta frase curta e uma voz não fornecem estimativa robusta nem comparação de sotaques/ruído. O particionamento também pode alterar o reconhecimento de fronteira.

## Referência

Fixture pública: amostra JFK distribuída pelo projeto whisper.cpp. O conteúdo de 11 s é o trecho “And so my fellow Americans ask not what your country can do for you. Ask what you can do for your country.” A frase “We choose to go to the moon...” não está neste arquivo. O ensaio detectou e corrigiu essa associação errada; o primeiro relatório com referência incorreta não é válido. Conferir a segmentação exata antes de usar como avaliação congelada.

## Resultado

Executado no Linux x64, Node 23.11.1, base.en CPU/int8: reconheceu as duas frases de referência; WER de 0% (0/22 palavras), mediana de 314 ms por bloco e inicialização de 296 ms. São apenas dois blocos correlacionados de uma única voz e fixture; não representam p95 ou desempenho geral. Relatório local `test-results/benchmark-asr/report-1794071172272.json`, regenerável pelo comando acima.

O conjunto ampliado abaixo agora executa localmente. O resultado segue limitado a um locutor e não é benchmark representativo.

## Conjunto pequeno selecionado

Oito trechos curtos foram extraídos de LibriSpeech `test-clean`, todos do falante 6930 e livro 75918. WAVs mono PCM 16 kHz e transcrições estão em `tests/fixtures/asr/librispeech-clean/`; `manifest.json` registra duração, atribuição, IDs, referências e SHA-256 dos FLACs originais e WAVs derivados. Cada gravação também tem uma variante acelerada a 1,2× e outra com ruído branco nominal de 12 dB SNR. Acelerar por reamostragem eleva também o pitch; ruído branco não representa uma sala real. A licença CC BY 4.0 está junto aos arquivos. O tarball de 331 MB foi removido após a extração; WAVs selecionados e variantes ocupam poucos MB.

A seleção cobre somente fala lida limpa de um falante. Ela é adequada para reproduzir verificações pequenas e criar variantes controladas de velocidade/ruído, mas não para afirmar generalização a sotaques, fala espontânea ou população diversa.

## Benchmark ampliado

`pnpm benchmark:asr` valida o hash de cada WAV, executa as 24 combinações localmente e grava detalhes por amostra em JSON. WER agrega substituições, omissões e inserções sobre o total de palavras de cada condição. Latência é ida e volta do worker por clipe; não inclui inicialização, captura ou UI.

| Condição            | Clipe | Palavras | Erros |   WER | Mediana ms | Máximo ms |
| ------------------- | ----: | -------: | ----: | ----: | ---------: | --------: |
| Limpa               |     8 |       76 |     4 | 5.26% |      293.8 |     358.2 |
| Acelerada 1,2×      |     8 |       76 |     4 | 5.26% |      249.3 |     287.3 |
| Ruído nominal 12 dB |     8 |       76 |     7 | 9.21% |      261.1 |     297.4 |

Execução Linux x64, Node 23.11.1, base.en CPU/int8. As condições derivam dos mesmos oito clipes de um único leitor; 76 palavras por condição são insuficientes para generalizar ou calcular um p95 confiável. O ruído é sintético e a variante acelerada altera pitch. Relatório local regenerável: `test-results/benchmark-asr/report-1794076567810.json`.
