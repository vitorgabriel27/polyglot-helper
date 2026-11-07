# Tradução local abaixo da transcrição

07/11/2026. Fonte oficial: `/home/vitor-g/polyglot-project`, branch `main`. Implementação local ainda não publicada no GitHub.

## Causa da ausência

O caminho de áudio real só produzia texto original e deixava translation vazio. A tradução exibida anteriormente existia apenas na demonstração. Não era erro da opção salva do usuário.

## Implementação

- Modelo OPUS/Argos inglês → português brasileiro, pacote translate-en_pb-1_9, SHA-256 fixo; CPU/int8, duas threads, processo separado do ASR.
- Original publicado imediatamente; tradução enfileirada sem aguardar para mostrar o original. Exibir Traduzindo… enquanto pendente.
- Associação por geração, ID, revisão e texto; resultados antigos não substituem frases atuais. Atualização de tradução permitida em segmento final sem reabrir sua transcrição.
- Uma tradução ativa + uma pendente atual; cache de no máximo 64 textos somente em memória, apagado ao parar. Tempo limite de inferência de 5 s, carregamento de 15 s.
- Desligar Tradução cancela o processo/fila e limpa a linha sem parar ASR. Ligar novamente traduz o segmento atual e os seguintes.
- Tradução indisponível gera aviso sob a frase, preservando a transcrição. Sem APIs ou envio de texto/áudio.

## Validação executada

- Node 23.11.1 usado conforme preferência do usuário: check completo passou (tipagem, lint, 22 testes unitários e build).
- Teste do worker local com duas frases de referência: português correto nos critérios simples e sem marcadores SentencePiece. Uma execução: 19 ms e 19 ms por frase; não é p95 nem benchmark de qualidade amplo.
- 6 testes desktop passaram, incluindo áudio público em saída PipeWire isolada → ASR → tradução → notch, desligar/religar tradução sem interromper captura e regressões de ciclo de vida.
- Screenshot de transcrição real com português abaixo inspecionado.
- Modelo e dependência SentencePiece preparados neste computador. Nada foi capturado do microfone pessoal para os ensaios.

## Limites

Primeiro par: inglês → pt-BR. Traduções parciais podem mudar conforme a própria transcrição é revista. Tradução é baseline local; não é avaliação de 30 frases, prova de qualidade geral ou integração do harness de agentes. IPA para áudio e validação nativa Windows continuam pendentes.
