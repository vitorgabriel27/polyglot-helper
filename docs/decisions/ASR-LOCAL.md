# ASR local inicial e candidato Parakeet v3

Data: 07/11/2026. Status: baseline Whisper implementado e ensaiado; Parakeet candidato, ainda não instalado/medido. Este documento trata de reconhecimento, não do decisor System 1.

## Baseline atual

Para validar captura → segmentação → worker → legenda, foi instalado faster-whisper 1.2.1 com modelo base.en em CPU/int8. Revisão/peso fixados em workers/asr/model.json; dependências Python 3.11 em lock universal Windows/Linux. Modelo não é baixado ao abrir o app nem ao iniciar captura; setup é etapa explícita.

A escolha inicial é de integração, não de vencedor de qualidade. Hardware observado: Intel Core 7 240H, 16 threads expostas, cerca de 30 GiB RAM, RTX 3050 Laptop 6 GiB. A GPU não foi usada neste baseline. Renderização sem GPU da UI não impede uso futuro de CUDA num worker separado.

O worker opera offline, PCM em memória, sem gravar áudio/transcrições em disco. Processa janelas com parciais a cada aproximadamente 2 s, fechamento por silêncio de 500 ms e limite de 6 s. Isso é inferência segmentada, não streaming nativo do modelo. Segmentos têm sequência, revisão, geração e tempos relativos à captura.

Fila: uma inferência ativa e uma janela pendente de até 6 s; substituir uma janela de outra sequência incrementa contador de perda e aviso. Não há fila ilimitada de áudio. Cancelar descarta as janelas e encerra o worker; gerações antigas não podem sobrescrever a legenda atual. Pré-buffer de 200 ms é só memória para começo de palavras. O detector de energia é pré-segmentação; Silero VAD do worker filtra a fala antes de ASR.

## Parakeet TDT 0.6B v3

O usuário sugeriu avaliar `nvidia/parakeet-tdt-0.6b-v3`. É candidato prioritário ao ASR principal local; o adapter SpeechBackend permite trocar o motor sem reimplementar a notch/captura.

Segundo a [model card oficial NVIDIA](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), o modelo tem 600 milhões de parâmetros, suporta 25 idiomas incluindo inglês/português/espanhol, detecção automática de idioma e timestamps. A mesma fonte observa treinamento em português europeu; pt-BR exige amostra própria. O modelo tem licença CC BY 4.0, com atribuição a preservar na distribuição.

A [documentação NVIDIA NIM](https://docs.nvidia.com/nim/speech/latest/asr/) classifica o perfil TDT v3 como offline. A model card oferece exemplo NeMo de inferência em chunks; isso não demonstra automaticamente a latência/revisão de legendas do nosso app. Comparar também candidatos de streaming apropriados quando o objetivo for menor atraso, sem confundir variantes Parakeet/RNNT/TDT.

Não se afirma que o runtime completo cabe em 6 GiB apenas pelo tamanho dos pesos. Medir pico de VRAM com chunks reais, buffers e aplicações concorrentes. A model card prefere Linux e cita mais de um runtime; avaliar NeMo, Transformers ou runtime nativo apenas após confirmar versões/suporte e paridade. Windows precisa teste próprio, não promessa baseada no Linux.

## Comparação a executar

| Opção                        | Papel proposto                                                          | Estado                                                |
| ---------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Whisper base.en / CPU int8   | Baseline de integração; candidato a fallback para inglês                | Implementado/testado em pequena fixture pública       |
| Parakeet TDT 0.6B v3         | Candidato multilíngue principal local; GPU ou runtime otimizado a medir | Sem benchmark no equipamento                          |
| ASR preparado para streaming | Comparador de latência/interatividade                                   | Variante/runtime pendentes                            |
| API remota                   | Último estágio opcional de cascata                                      | Sem autorização operacional/credenciais; desconectada |

Usar os mesmos áudios/segmentos e medir WER por idioma/sotaque, ruído, revisão de legenda, p50/p95 ponta a ponta, VRAM/RAM/CPU, tempo de carregamento, instalação e consumo de energia quando mensurável. Não comparar apenas velocidade de processamento de arquivo com atraso percebido ao vivo. Adicionar trechos pt-BR, inglês e espanhol antes de escolher motor principal.

Parakeet ou Whisper fazem ASR; o roteador System 1 continua um componente separado, e nenhuma confiança do ASR autoriza nuvem/captura. Não haverá fallback remoto implícito se faltar VRAM ou se um modelo errar.

## Evidências do baseline, sem generalização

- Setup: download dos pesos e verificação SHA-256; sem envio de áudio.
- Worker offline com fixture JFK pública: carregamento 357 ms, inferência de trecho de 6 s em 324 ms, silêncio sem texto e cancelamento em andamento validados numa execução. Não é p95 nem benchmark amplo.
- Teste local PipeWire isolado → PCM → segmentador → worker → resultado parcial/final passou. A fixture é baixada apenas pelo teste; inferência não consulta a rede.
- Testes unitários verificam silêncio, limite de janelas, backpressure e cancelamento; regressões desktop preservam onboarding e preferências.

O estágio não implementa tradução real, IPA para fala, System 1 treinado, Parakeet nem cascata real. Esses itens permanecem no roadmap.

Relatório reproduzível da implementação: [ASR-INICIAL.md](../validation/ASR-INICIAL.md).
