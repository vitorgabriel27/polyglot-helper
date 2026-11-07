# Evidências da primeira transcrição local

07/11/2026. Pasta oficial `/home/vitor-g/polyglot-project`, branch `main`.

## Executado

- Instalado Python 3.11 em `.asr-venv` com dependências lockadas; não alterado o Python 3.14 do sistema.
- Preparado modelo `base.en`, CPU/int8, revisão e SHA-256 fixados; arquivos em `.models`, fora do Git.
- `pnpm check`: tipagem, lint, 17 testes unitários e build passaram. Dois ensaios nativos ficam ignorados por padrão.
- Compilação sintática dos scripts Python passou.
- `pnpm test:asr`: worker offline reconheceu trecho da fixture pública JFK, ignorou silêncio e cancelou inferência. Uma execução: boot 357 ms; reconhecimento de 6 s de áudio em 324 ms. Números pontuais, não p95.
- `HELPER_ASR_TEST=1 pnpm exec vitest run tests/live-asr.integration.test.ts`: passou; PipeWire isolado → PCM → segmentação → worker → respostas parcial/final. Duração total do ensaio: 7,38 s; esse valor não é latência de uma legenda.
- Testes desktop de onboarding/demo/preferências continuaram passando.
- `HELPER_ASR_TEST=1 pnpm exec playwright test tests/desktop/asr.spec.ts`: passou em 6,9 s. Fala pública chegou à notch, pausa limpou segmento, retomada carregou nova sessão e parar encerrou reconhecimento/captura. Screenshot de legenda real inspecionado.
- Catálogo PipeWire verificado após limpeza: nenhum nó `polyglothelper-selftest-*` restante.

## Dados e privacidade do ensaio

Fixture: [JFK no projeto whisper.cpp](https://github.com/ggml-org/whisper.cpp/blob/master/samples/jfk.wav), SHA-256 `59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e`. O teste baixa essa fixture pública; não faz upload de áudio nem abre microfone. Reprodução/captura ficam em saída virtual isolada. O processo de inferência força modo offline e lê modelo/tokenizer locais.

Não houve benchmark com conversas pessoais, seleção automática de nuvem ou treinamento de roteador. Pesos e ambiente foram instalados no workspace, não incluídos em um instalador distribuível.

## Limites

- Modelo ASR atual só reconhece inglês. A tradução local está implementada em worker separado; IPA para áudio e integração do controlador do harness ao fluxo real de ASR continuam pendentes.
- Segmentação por energia é aproximada; Silero VAD atua no worker. Avaliar fala baixa, música, ruído e corte de palavras em janelas de 6 s.
- Whisper não virou vencedor do benchmark. [Parakeet v3 está na comparação planejada](../decisions/ASR-LOCAL.md), sem números inventados para a RTX 3050.
- Windows captura não integrada; worker/protocolo/setup escritos para Windows/Linux, validação nativa ainda pendente.
- Reabrir o app após build para carregar código atualizado; a instância anterior não é reiniciada automaticamente durante uma captura do usuário.
