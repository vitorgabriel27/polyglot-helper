# PolyglotHelper — metas e tarefas de execução

Atualizado em 10/11/2026. Status: piloto local Linux em evolução, com notch aceita pelo usuário, onboarding persistente, captura PipeWire, transcrição Whisper, tradução local e base de controle do harness implementados. M0, Windows e aceite completo do marco MR seguem parciais. Preferências permitem escolher inglês (EUA), português (Brasil), italiano, francês, alemão e chinês simplificado (mandarim) como entrada/saída. Salvar baixa ASR e pacotes Argos dos pares escolhidos; pares sem ligação direta usam inglês como ponte. Hashes de downloads Argos são calculados localmente, não assinados/publicados pelo fornecedor; desempenho e qualidade dos novos pares ainda não foram avaliados.

## Estado atual e próxima sequência

- **Implementado no Linux:** notch e configuração rápida, preferências persistentes, captura local, ASR Whisper base.en e tradução OPUS/Argos em worker separado. O original aparece imediatamente e a tradução abaixo; desligar tradução preserva o ASR.
- **Verificado:** check local com Node 23.11.1 (tipagem, lint, 22 testes unitários e build), 6 testes desktop e inspeção visual de legenda real traduzida. Prettier integrado ao fluxo. Evidências em [TRADUCAO-LOCAL.md](validation/TRADUCAO-LOCAL.md).
- **Corrigido:** acesso a janelas destruídas ao reabrir configurações/iniciar outra instância; regressões de ciclo de vida cobertas nos testes desktop.
- **Pendente:** benchmark amplo, IPA real, captura e testes nativos Windows, System 1 treinado, integração dos modelos reais à cascata e instaladores. Nenhum marco multiplataforma está concluído.

Ordem prática para continuar, mantendo os IDs abaixo:

1. **TR-04 + STT-04:** ensaio inicial de tradução disponível em [BENCHMARK-TRADUCAO.md](validation/BENCHMARK-TRADUCAO.md), com 30 frases e 90 observações; revisão bilíngue pendente. O benchmark ASR em [BENCHMARK-ASR.md](validation/BENCHMARK-ASR.md) já foi executado em 24 clipes derivados de um locutor, nas condições limpa, acelerada e ruído sintético. Ainda faltam música, diversidade de locutores e execução Windows; latências medidas não são p95 ponta a ponta.
2. **AUDIO-02 + STT-04/05:** reduzir/medir o buffer conforme alvo, ampliar avaliação ASR (incluindo música e outras condições) e executar ciclos repetidos com troca/remoção de fonte.
3. **MR-06 e MR-09 a MR-15:** preparar dataset e treinar/avaliar System 1; depois integrar modelos reais e comparar baselines. A infraestrutura MR-01 a MR-05 e MR-07/08 já está implementada; evidências em [MR-HARNESS.md](validation/MR-HARNESS.md). Ainda não está ligada ao fluxo de ASR/tradução do app.
4. **DEC-01/06 + WIN-01/02/03:** identificar Windows no próximo boot, clonar o repositório e implementar/validar captura e integração nativas. Trabalho Linux pode avançar enquanto essa máquina não é testada.
5. **PH-01/02/03 e M6:** integrar pronúncia com fonte licenciada, empacotar e executar o aceite completo nos dois sistemas, incluindo MR.

## Objetivo da entrega

Entregar um piloto desktop para **Windows e Linux**: notch discreta com transcrição de áudio ao vivo, tradução opcional e configurações rápidas ao clicar. Os dois sistemas fazem parte do MVP. Código de produto compartilhado; captura, integração com o desktop e instaladores têm implementações e validações próprias.

O protótipo HTML anterior é uma exploração de interface e não conta como tarefa concluída deste plano.

## Ampliação de escopo — pesquisa aplicada

O usuário incluiu harness de agentes, System 1 local, cascatas de modelos e escalada até nuvem. Especificação em [HARNESS-CASCATAS.md](research/HARNESS-CASCATAS.md). Os resultados do artigo não são métricas do PolyglotHelper. O marco MR abaixo passa a integrar o piloto; não é trabalho concluído.

## Convenções e premissas

- `[ ]` pendente; `[x]` concluída. Para concluir, registrar evidência no PR ou relatório de validação, não apenas marcar a caixa.
- P0: necessário ao piloto; P1: etapa seguinte; P2: expansão.
- Estimativas em dias de trabalho de uma pessoa, incluindo integração e verificação; não representam datas prometidas. Cada marco depende do anterior, salvo tarefas explicitamente independentes.
- Responsável técnico inicial: implementação assistida pelo Codex. Decisões de produto, orçamento, credenciais e teste com usuários: responsável pelo projeto.
- Stack implementada: Electron/TypeScript, React/Vite/CSS, Zustand, PipeWire no Linux e workers Python com faster-whisper e CTranslate2/SentencePiece (OPUS/Argos). Adaptadores Windows e serviços remotos seguem pendentes. Deepgram/DeepL são candidatos, sem seleção ou ativação operacional.
- Não comprar serviços, ativar captura nem enviar áudio como consequência deste planejamento.

## Visão dos marcos

| Marco | Meta e entrega                                         | Estimativa                                     | Dependência                               |
| ----- | ------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------- |
| M0    | Escopo e matriz de suporte decididos                   | 0,5–1 dia                                      | Nenhuma                                   |
| M1    | Sobreposição e captura viáveis nos dois sistemas       | 3–6 dias                                       | M0                                        |
| M2    | Base compartilhada e contratos estáveis                | 2–3 dias                                       | M1                                        |
| MR    | Harness, System 1, gate, cascata e avaliação inicial   | A estimar após inventário e desenho do dataset | M2; protocolo/dataset podem começar antes |
| M3    | Transcrição real de ponta a ponta integrada ao harness | 3–5 dias, a revisar com MR                     | M2 + contratos/gate/cascata de MR         |
| M4    | Notch mínima e configuração rápida integradas          | 2–4 dias                                       | M3                                        |
| M5    | Tradução e pronúncia opcional                          | 3–5 dias                                       | M4                                        |
| M6    | Instaladores e piloto validado em ambos os SOs         | 3–5 dias                                       | M5                                        |

Estimativa histórica anterior à inclusão do harness: **16,5–29 dias de trabalho**, mais disponibilidade de máquinas, contas e usuários. Reestimar após M1. Processamento totalmente local, integração específica de Wayland ou assinatura comercial podem alterar esforço e prazo. Não declarar suporte multiplataforma com apenas testes em um SO. **O total atual não está fechado**: incluir MR e reestimar M3/M5/M6 antes de prometer datas.

## M0 — Fechar decisões antes de codificar · P0

Status: 3 de 6 tarefas concluídas. Evidências e decisões em [M0-ESCOPO.md](decisions/M0-ESCOPO.md) e [M0-AMBIENTE.md](validation/M0-AMBIENTE.md). DEC-01/06 parciais: Linux identificado e Windows dual boot informado, ainda sem identificação/acesso verificados. DEC-03: comparar remoto/local antes de escolher, conforme resposta do usuário. Nenhum envio remoto autorizado.

- [ ] **DEC-01** Registrar Windows e Linux como plataformas do MVP; escolher versão/arquitetura Windows e distribuição/desktop Linux de referência. Saída: matriz nomeando versões, x64/ARM64 e ambientes realmente cobertos.
- [x] **DEC-02** Registrar política de Wayland e X11: quais serão testados e quais podem ter limitações. Saída: suporte prometido separado de experimental e não testado.
- [ ] **DEC-03** Comparar local-only, cloud-only e harness híbrido; escolher configuração de cascata, modelos e limites de latência/custo. Harness local com escalada seletiva é a direção definida pelo usuário; autorização operacional de envio, credenciais e teto financeiro continuam pendentes. Até lá, nuvem simulada.
- [x] **DEC-04** Fechar par inicial inglês americano → português brasileiro e disposição: original + tradução opcional; pronúncia por seleção/opção.
- [x] **DEC-05** Definir restrições visuais: topo central preferencial, posição alternativa aceitável, duas linhas de original, expansão ao clicar e nenhum dashboard permanente.
- [ ] **DEC-06** Garantir ambiente de execução Windows e Linux para testes reais; registrar limitações de VM para áudio/GPU/foco.

**Concluído quando:** decisões documentadas e máquinas de validação acessíveis. Tarefas independentes podem avançar sem decisões sobre serviços pagos.

## M1 — Reduzir riscos de plataforma · P0

Exceção de sequência autorizada pelo usuário: desenvolver no Linux e adiar identificação/validação nativa Windows para o clone posterior. BASE-01 e segurança inicial antecipados para viabilizar a janela técnica. LIN-01/WIN-01 seguem parciais, não concluídos: ensaio automatizado não cobre monitores, foco externo e fullscreen.

- [ ] **WIN-01** Janela técnica no Windows: sem moldura, sobreposta, expansão e fechamento do popover por Escape/clique fora. Verificar que o desktop fora da notch continua clicável.
- [ ] **WIN-02** Captura de saída do sistema por loopback e microfone separadamente. Avaliar caminho Electron/Chromium na versão fixada; encapsular alternativa nativa se necessário. Medir troca de dispositivo e parada sem captura residual.
- [ ] **WIN-03** Validar foco, dois monitores, escalas diferentes e vídeo em tela cheia. Registrar comportamento em tela cheia exclusiva como restrição quando aplicável.
- [ ] **LIN-01** Janela técnica em cada compositor da matriz: posição, sobreposição, foco, expansão, cliques e monitor secundário. Não assumir que arraste/posição programática resolve restrições Wayland.
- [ ] **LIN-02** Captura PipeWire de saída do sistema e microfone separadamente; testar escolha de fonte, troca para fones e permissões/portais quando aplicáveis.
- [ ] **LIN-03** Se o requisito de notch não funcionar no compositor escolhido, produzir decisão arquitetural com evidência: integração específica de desktop/layer-shell ou limitação explícita. Reestimar antes de ampliar a UI.
- [ ] **PLAT-01** Consolidar tabela comparativa Windows/Linux, com versão do SO, desktop, Electron, resultado e reprodução de cada falha.

**Concluído quando:** ambos capturam 60 s de áudio e exibem uma janela técnica utilizável; restrições têm solução ou decisão explícita. Esses ensaios não são o protótipo visual final.

## Requisitos de primeira abertura — adicionados pelo usuário

- [x] **UX-01** Mostrar configuração inicial uma vez; restaurar fonte/visual e permitir edição posterior sem repetir onboarding.
- [x] **UX-02** Persistir preferências com esquema, escrita atômica e recuperação de arquivo inválido; validar reabertura com perfil temporário.
- [ ] **UX-03** Autostart opt-in por sistema: Linux implementado/testado em diretório temporário; Windows implementado via Electron, teste nativo pendente. Abrir ao login nunca inicia captura.
- [ ] **UX-04** Sobreposição contínua sem roubar foco: política reforçada e XWayland padrão; completar validação de troca entre apps, fullscreen e monitores nos dois SOs.

Decisão e limites: [OVERLAY-PREFERENCIAS.md](decisions/OVERLAY-PREFERENCIAS.md). Evidências: [CAPTURA-PREFERENCIAS.md](validation/CAPTURA-PREFERENCIAS.md). LIN-01: usuário confirmou funcionamento da notch; ainda faltam cenários de escala/tela cheia/múltiplos monitores. LIN-02: catálogo/captura real PipeWire e 60 s sintéticos isolados validados; microfone físico, troca para fones e remoção exigem teste manual. Windows continua adiado.

## M2 — Construir a fundação compartilhada · P0

- [x] **BASE-01** Criar projeto pnpm com Electron, React, Vite e TypeScript; fixar versões estáveis na implementação e gerar lockfile.
- [x] **BASE-02** Separar módulos: desktop/main, preload, renderer, core/session, adapters/audio, adapters/speech e adapters/translation; evitar duplicar UI por SO.
- [x] **BASE-03** Definir contratos AudioSource, AudioChunk, TranscriptSegment, SpeechProvider, TranslationProvider e eventos tipados, incluindo sessão, geração, revisão e timestamps.
- [x] **BASE-04** Implementar máquina de estados: idle, starting, listening, paused, reconnecting, error e stopping; estado do popover independente da captura.
- [x] **BASE-05** Configurar preload restrito, sandbox, contextIsolation, validação de IPC e CSP. Renderizar transcrição como texto.
- [ ] **BASE-06** Persistir preferências em JSON versionado com gravação atômica e recuperação de arquivo inválido. Armazenamento seguro de credenciais por SO; sem fallback em texto puro.
- [x] **BASE-07** Automatizar tipagem, lint, build e testes de contratos em Windows/Linux. Se CI não estiver disponível, documentar comandos e execução local nos dois.

**Concluído quando:** app abre nos dois sistemas, adaptadores simulados produzem eventos e a UI não tem acesso direto a segredos ou dispositivos.

Evidência atualizada: [fundação M2](validation/M2-FUNDACOES.md), contratos em `src/core/contracts.ts`, ciclo em `src/core/session.ts`, adaptadores e workflow `.github/workflows/check.yml`. M2 está concluído no código compartilhado e na automação. O aceite de abertura/execução nativa Windows ainda depende do M1/DEC-06. BASE-06 permanece parcial: preferências versionadas com escrita atômica e recuperação implementadas; armazenamento seguro de credenciais fica pendente até selecionar um provedor que precise delas. Não há credenciais nem chamadas remotas no app atual.

## MR — Aplicar pesquisa ao harness · P0

Dois blocos: MR-01 a MR-05 e MR-07/08 formam a base de integração de M3; treinamento, ablações e avaliação final dependem de dados/modelos reais e continuam durante M3–M6. M6 também depende do aceite completo de MR. Não há dependência circular entre benchmark e integração.

- [x] **MR-01** Definir agentes de captura, STT, tradução e léxico; contratos de proposta, observação e catálogo mínimo, sem execução arbitrária. Evidência: contratos e interfaces em `src/core/harness/contracts.ts` e `src/core/harness/agents.ts`.
- [x] **MR-02** Implementar gate determinístico versionado separado do roteador; validar ação, fonte, destino, geração, argumentos, TTL e política offline; fail-closed em falha. Evidência: `src/core/policy/gate.ts`; casos de bloqueio e versão em `tests/harness.test.ts`.
- [x] **MR-03** Implementar autorização vinculada/uso único e lease de streaming revogável; testar replay, revogação entre decisão e execução e versão obsoleta. Evidência: tickets vinculados a sessão/geração/versão/argumentos em `src/core/policy/gate.ts`; lease revogável em `src/core/policy/stream-lease.ts`; replay e revogação cobertos em `tests/harness.test.ts`.
- [x] **MR-04** Implementar controlador da cascata por tarefa, estágios limitados, cancelamento e budgets de tempo/memória/custo; nuvem simulada por padrão. Evidência: `src/core/cascade/controller.ts`; no máximo três estágios e nuvem ignorada em modo offline. Controlador ainda não está integrado aos adaptadores de produto.
- [x] **MR-05** Especificar ring buffer de reprocessamento ASR separado do buffer de transporte; definir limites medidos e comportamento para áudio expirado. Evidência: buffer independente e limitado por duração/bytes em `src/core/audio/reprocessing-ring-buffer.ts`, com expiração coberta por `tests/harness.test.ts`. Limites finais do produto dependem de medição no fluxo ASR.
- [ ] **MR-06** Preparar dataset próprio, separado por sessão/locutor/paráfrase; registrar referência, políticas, consentimento, splits e conjunto congelado. Nenhum treino automático com captura do usuário. Parcial: validador de JSONL verifica metadados, consentimento vigente, hash, splits e vazamento de grupos em `scripts/research/validate_dataset.py`; testes sintéticos em `tests/research-dataset.test.ts`. Ainda não há amostras próprias autorizadas nem teste congelado; evidência em [MR-DATASET-PREP.md](validation/MR-DATASET-PREP.md).
- [x] **MR-07** Criar fixtures e replay offline Windows/Linux para decisões, mudanças de política e falhas; sem APIs pagas para validar controle. Evidência: casos sintéticos em `tests/fixtures/harness/replay.json` e execução determinística em `tests/harness.test.ts`. Suíte executada neste ambiente Linux; Windows ainda requer execução nativa.
- [x] **MR-08** Adicionar trilha sanitizada com versões, rotas, gate, latência e consumo, sem transcrições/credenciais por padrão. Evidência: `src/core/observability/audit.ts` e teste de serialização sanitizada em `tests/harness.test.ts`.
- [ ] **MR-09** Treinar baseline TF–IDF + regressão logística; calibrar e avaliar OOD por tarefa; comparar regras. Não reutilizar limiar/dataset de TI como resultado de idiomas.
- [ ] **MR-10** Integrar worker System 1 e modelos locais reais; comparar Parakeet TDT 0.6B v3 ao baseline Whisper e a um candidato streaming no mesmo hardware/dataset; medir CPU/GPU/footprint; escolher tradução local com licença compatível.
- [ ] **MR-11** Avaliar exportação ONNX versus worker Python, exigindo paridade de features, scores, OOD e rotas nos dois sistemas; registrar decisão de distribuição.
- [ ] **MR-12** Integrar API seletiva só após política/credenciais/budget definidos; validar payload mínimo, quota, timeout e zero envio em offline estrito.
- [ ] **MR-13** Executar baselines local-only/cloud-only/cascata fixa/harness; ablações sem gate somente em sandbox simulado. Congelar thresholds antes do teste.
- [ ] **MR-14** Testar pares de constraint shift: revogação de nuvem, fonte, orçamento, catálogo e stop, com texto constante; incluir prompt injection em conteúdo e omissões de intenção. Parcial: `tests/constraint-shift.test.ts` fixa a mesma transcrição/proposta e varia fonte, modo offline, orçamento, geração, versão do catálogo e stop; prompt injection é tratado como dado e a política de destino segue autoritativa. Omissões/rotas do System 1 não são avaliáveis até haver roteador e rótulos próprios.
- [ ] **MR-15** Publicar relatório com cobertura, risco seletivo, sucesso útil, violações, bloqueio indevido, WER, tradução, latência, recursos e custo total; amostras/repetições/incerteza e falhas explícitas.

**Concluído quando:** cascata opera com System 1 local real nos dois SOs, gate controla todos os efeitos, teste congelado não apresenta execução não autorizada observada e comparação é reproduzível. Metas de cobertura/risco/economia serão fixadas em validação antes do teste; nenhum percentual do artigo é promessa de desempenho. Resultado zero na suíte não é garantia universal.

## M3 — Fazer transcrição ao vivo funcionar · P0

Status: 3 de 7 tarefas concluídas no caminho Linux/local. Captura PipeWire → PCM mono 16 kHz → segmentador → faster-whisper `base.en` CPU/int8 → legenda está integrada e ensaiada com áudio sintético isolado e fixture pública. O fluxo de produto e o modelo ainda não foram validados nativamente no Windows; M3 continua parcial.

- [x] **AUDIO-01** Integrar adaptadores validados em M1; worker normaliza formato e preserva sequência/timestamps sem bloquear UI. Evidência Linux: `PipeWireAudio` entrega PCM mono s16/16 kHz, `UtteranceSegmenter` emite sequência/revisão/tempos e o ASR roda em processo separado; teste integrado documentado em [ASR-INICIAL.md](validation/ASR-INICIAL.md). Windows permanece sem adaptador/captura nativa validada.
- [ ] **AUDIO-02** Limitar buffer a 2 s inicialmente; sinalizar saturação e desconexão, sem acumular atraso indefinido. Parcial: fila tem uma inferência ativa e uma janela pendente limitada, perdas são contadas e watchdog reporta ausência de áudio; porém a janela de ASR chega a 6 s (pré-buffer de 200 ms), não ao alvo de 2 s. Ver [ASR-LOCAL.md](decisions/ASR-LOCAL.md) e `src/core/speech.ts`.
- [ ] **STT-01** Implementar provedor escolhido, após DEC-03; parametrizar idioma/modelo e tratar conexão, timeout, credencial inválida e quota. Parcial: `LocalSpeech` e worker offline `base.en` estão integrados, com limites de inicialização/inferência e erro de processo; modelo/idioma são fixos e DEC-03 segue pendente, sem credenciais/quota porque nenhum provedor remoto foi escolhido/ativado.
- [x] **STT-02** Atualizar parciais no mesmo segmento; distinguir intervalo finalizado de fim de enunciado. Evidência: `UtteranceSegmenter` conserva `sequence` e incrementa `revision`; `isFinal` fecha por silêncio de 500 ms ou limite de janela; testes em `tests/speech.test.ts`.
- [x] **STT-03** Pausar/parar fecha captura e conexão, invalida geração e descarta eventos tardios; retomar não reproduz áudio da pausa. Evidência: `endCapture` para captura e worker, `Session.pause/stop` incrementam geração e limpam segmento; testes em `tests/session.test.ts`, `tests/speech.test.ts` e teste desktop ASR em `tests/desktop/asr.spec.ts`. Ensaio real integrado documentado para Linux; Windows pendente.
- [ ] **STT-04** Criar amostra controlada de voz limpa, ruído/música e fala rápida, com referência escrita. Registrar erro de transcrição e latência por condição e por SO. Parcial: benchmark reproduzível com referência, WER e latência por amostra em [BENCHMARK-ASR.md](validation/BENCHMARK-ASR.md), 8 trechos de um locutor em condições limpa/acelerada/ruído sintético; não inclui música, diversidade de locutores nem execução Windows.
- [ ] **STT-05** Verificar 10 ciclos de iniciar/pausar/retomar/parar, troca de fonte e desconexão de dispositivo sem recursos presos. Parcial: há teste desktop de um ciclo de pausa/retomada/parada; o adaptador tem watchdog para ausência de áudio, mas ainda não há ensaio de desconexão nem sequência de 10 ciclos com troca de fonte e verificação de recursos.

**Concluído quando:** transcrição real funciona em Windows e Linux e nenhuma geração encerrada altera a legenda atual. Meta inicial parcial p95 ≤ 1,5 s, medida do fim do trecho de referência até sua exibição; registrar resultado real e reavaliar se não atingir. Medições existentes são latências de worker/amostras pequenas, não p95 ponta a ponta.

## M4 — Entregar a notch mínima · P0

Status: 1 de 6 tarefas concluída; as outras têm partes implementadas. A notch, o painel rápido e seus controles existem no Linux, mas faltam opções e evidências para fechar o aceite visual e de acessibilidade.

- [ ] **UI-01** Implementar notch recolhida, legendando, pausada e em erro; largura limitada e original em até duas linhas, com política explícita para frases longas. Parcial: barra recolhida, legenda durante sessão, erro e limite de duas linhas existem em `src/renderer/NotchView.tsx`/`src/renderer/style.css`; estado pausado não tem indicação própria além do botão para iniciar, e o truncamento não é comunicado.
- [ ] **UI-02** Implementar popover ao clicar: fonte, idiomas, tradução, pronúncia, tamanho e pausar/parar; controles indisponíveis devem explicar a dependência. Parcial: painel tem seletores independentes de entrada/saída para inglês (EUA), português (Brasil), italiano, francês, alemão e chinês simplificado (mandarim); Salvar prepara ASR e tradução via Argos, com inglês como ponte quando necessário. IPA para fala não está disponível.
- [x] **UI-03** Escape/clique fora fecha apenas o popover; durante acompanhamento, não roubar foco do app usado. Evidência: Escape fecha o painel; blur o oculta sem parar a sessão; `keepAbove` reposiciona a notch sem chamar foco. Teste `tests/desktop/notch.spec.ts` verifica Escape e que o app-alvo permanece focado no Linux/X11.
- [ ] **UI-04** Atalho de pausa/retomada e saída pelo tray; detectar conflito de atalho e permitir trocar. Recuperar notch fora da tela após desconectar monitor. Parcial: atalho fixo Ctrl/Cmd+Shift+Espaço, conflito refletido por `shortcutAvailable`, menu tray e reposicionamento em eventos de monitor existem em `src/desktop/main.ts`/`src/desktop/window-position.ts`; ainda não há UI para trocar o atalho nem validação da recuperação após desconexão.
- [ ] **UI-05** Aplicar preferências ao reiniciar; suportar teclado, contraste e redução de movimento. Parcial: preferências são persistidas e restauradas; foco de teclado é visível e `prefers-reduced-motion` é respeitado. Não há tratamento específico para modo de alto contraste/forced colors.
- [ ] **UI-06** Fazer verificação visual nas escalas e monitores da matriz, incluindo rótulos longos e fonte maior. Parcial: há screenshots e inspeção da notch/configurações no Linux descritas em `docs/validation/BASE-DESKTOP.md`; ainda não cobrem toda a matriz, escalas, monitores, estado de erro ou conjunto de rótulos longos.

**Concluído quando:** iniciar, acompanhar e parar funciona sem abrir uma tela principal; configuração comum leva no máximo dois cliques após abrir o painel, exceto listas que exigem rolagem.

## M5 — Adicionar tradução e pronúncia · P0

Tradução local inicial implementada e validada na notch: original imediato, português abaixo, cancelamento ao desativar e proteção contra resposta atrasada. TR-01/02/03 têm implementação inicial e regressões, mas o marco segue parcial: avaliação contextual ampla (TR-04), IPA e validação Windows ainda pendentes. Ver [TRADUCAO-LOCAL.md](validation/TRADUCAO-LOCAL.md).

- [ ] **TR-01** Integrar tradução de segmentos estáveis com contexto curto, limite de duração e cancelamento; tradução desligada não cria novas chamadas.
- [ ] **TR-02** Associar tradução ao ID/revisão; testar resposta fora de ordem, troca de idioma e pausa durante uma chamada.
- [ ] **TR-03** Manter original visível em falha da tradução; identificar tradução pendente e impedir associação com outra frase.
- [ ] **TR-04** Medir qualidade em pelo menos 30 frases, incluindo expressões; registrar divergências e custo/hora conforme tarifas consultadas na execução.
- [ ] **PH-01** Escolher fonte lexical com licença compatível e variante en-US; documentar formato, atribuição e comportamento para palavras ausentes.
- [ ] **PH-02** Mostrar IPA por seleção de palavra/opção, sem terceira linha permanente por padrão; não inventar resultado para palavra sem entrada.
- [ ] **PH-03** Verificar pronúncia de 20 palavras com fonte de referência; decidir separadamente se aproximação PT-BR entra nesta versão.

**Concluído quando:** tradução e pronúncia opcional funcionam sem desorganizar a notch. Meta de tradução p95 ≤ 3 s após fim do segmento enviado. Sem fonte lexical decidida, o marco não pode ser marcado completo.

## M6 — Empacotar e validar o piloto · P0

- [ ] **REL-01** Gerar instalador Windows e pacote Linux escolhido em M0 com electron-builder, em runners/ambientes adequados a cada alvo.
- [ ] **REL-02** Testar instalação limpa, primeira execução, permissões, reinício e desinstalação em ambos; credenciais e preferências não vão dentro do instalador.
- [ ] **REL-03** Executar sessão de 30 min por SO e medir CPU, RAM, filas e latência. Após aquecimento, investigar crescimento contínuo de memória; comparar primeira e última janela de medição para detectar atraso crescente.
- [ ] **REL-04** Injetar rede indisponível, quota, fonte removida e resposta atrasada. Confirmar recuperação sem captura oculta e sem legenda antiga apresentada como atual.
- [ ] **REL-05** Verificar que áudio e transcrições não persistem em disco/logs por padrão e que parar encerra a captura.
- [ ] **REL-06** Documentar instalação, sistemas efetivamente testados, limitações, dependência de internet, destino dos dados e custo medido. Registrar alertas de instalador não assinado; assinatura pública fica para distribuição.
- [ ] **REL-07** Testar com 3–5 pessoas; pelo menos uma sessão por SO. Observar início, alteração de configuração e parada sem ajuda; registrar problemas e corrigir bloqueadores.
- [ ] **REL-08** Publicar checklist final de aceite com evidências, falhas conhecidas e decisão de liberar piloto. Não marcar plataforma sem evidência nativa.

**Concluído quando:** artefatos instaláveis e fluxo completo validados nos dois sistemas, sem bugs que impeçam iniciar/parar ou exponham credenciais/captura não solicitada.

## Próximas entregas, fora do piloto mínimo

- [ ] **NEXT-01 · P1** Vocabulário salvo e revisão local; adotar SQLite somente nessa etapa.
- [ ] **NEXT-02 · P1** OCR de região como entrada alternativa de segmentos, sem exigir áudio.
- [ ] **NEXT-03 · P1** Ampliar modo local do MR com novos motores e otimizações após o baseline; execução local inicial agora faz parte do MR, não desta extensão.
- [ ] **NEXT-04 · P1** Gateway para distribuir a terceiros: autenticação, quotas, segredos no servidor e gestão de custos.
- [ ] **NEXT-05 · P1** Assinatura de código, atualização e política de suporte por versão.
- [ ] **NEXT-06 · P2** TTS/repetição lenta, mais idiomas, captura por aplicativo quando suportada e sincronização opcional.

- [ ] **NEXT-07 · P1** Histórico de traduções navegável para trás e para frente. Definir retenção, limite e limpeza; distinguir histórico da legenda ao vivo. Persistência de transcrições deve ser uma escolha explícita do usuário.
- [ ] **NEXT-08 · P1** Avaliar entrada/saída entre inglês, português brasileiro, italiano, francês, alemão e chinês simplificado (mandarim). Download e roteamento Argos via inglês implementados; medir ASR/tradução por idioma com referências e validar qualidade/recursos nos dois SOs.
- [ ] **MODEL-01 · P1** Endurecer o gerenciador de modelos: substituir hashes calculados após download por hashes assinados/publicados, revisão imutável do catálogo, cancelamento/retomada e instalação transacional. Atual: manifests locais preservam URL/revisão e SHA-256 observado, que detecta alteração posterior mas não autentica o download inicial; extração depende do ambiente local preparado.
- [ ] **NEXT-09 · P2** Modelar modo tutor: usuário fala e o app responde e corrige pronúncia, gramática e concordância. Definir turnos, critérios de avaliação, feedback e integração com o harness antes de implementar.
- [ ] **NEXT-10 · P1** Redesenho inicial implementado: cápsula preta, expansão por hover/foco, segmento anterior/atual e tradução opcional. Restam revisão visual de todos os estados e validação Windows/compositores; sincronização por palavra depende de timestamps. Detalhes e evidências em [REDESIGN-NOTCH.md](design/REDESIGN-NOTCH.md).

As três propostas acima foram incorporadas do arquivo temporário `new_features`, removido após a consolidação. Permanecem fora do aceite do piloto mínimo.

## Registro de progresso

| Data       | Marco/tarefa                          | Evidência                                                                                                                               | Resultado / próximo passo                                                                                                                                                                                                                              |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 07/11/2026 | Ferramentas e estabilidade            | Prettier/ESLint; tests/desktop/notch.spec.ts                                                                                            | Formatação integrada e regressões de reabertura/segunda instância cobertas                                                                                                                                                                             |
| 07/11/2026 | Backlog de produto                    | NEXT-07/08/09                                                                                                                           | Histórico, três idiomas e modelagem do tutor incorporados; implementação pendente                                                                                                                                                                      |
| 07/11/2026 | Planejamento                          | Este arquivo e ARQUITETURA.md                                                                                                           | Plano salvo; Windows e Linux incluídos                                                                                                                                                                                                                 |
| 07/11/2026 | Tradução local inicial                | core/translation; workers/translation; TRADUCAO-LOCAL.md                                                                                | Inglês → pt-BR abaixo da transcrição; opção salva e cancelamento; 22 unitários e 6 desktop passaram com Node 23                                                                                                                                        |
| 07/11/2026 | ASR local inicial                     | workers/asr; core/speech; testes de ASR                                                                                                 | Whisper base.en/CPU preparado, worker offline e caminho PipeWire testados; Parakeet v3 candidato; Windows e harness pendentes; tradução local adicionada posteriormente                                                                                |
| 07/11/2026 | Captura e onboarding / UX-01 e UX-02  | src/adapters/audio; settings-store; testes                                                                                              | Notch aceita pelo usuário; captura local Linux e preferências implementadas; autostart opt-in; Windows nativo pendente                                                                                                                                 |
| 07/11/2026 | Base desktop / BASE-01 e BASE-05      | src/desktop; tests; DESENVOLVIMENTO.md                                                                                                  | Pasta oficial e main definidas; notch/demo e IPC restrito; checks locais; Windows nativo adiado por decisão do usuário                                                                                                                                 |
| 07/11/2026 | Pesquisa / novo MR                    | research/HARNESS-CASCATAS.md                                                                                                            | Artigo lido; arquitetura adaptada; 15 tarefas de pesquisa adicionadas; implementação pendente; prazo global a reestimar                                                                                                                                |
| 07/11/2026 | MR-01 a MR-05, MR-07/08               | validation/MR-HARNESS.md; src/core/{harness,policy,cascade,audio,observability}; tests/harness.test.ts                                  | Contratos, gate, autorização/lease, controlador, ring buffer, replay offline e auditoria implementados. `pnpm typecheck` e `pnpm test`: 35 passaram, 2 ignorados, incluindo 11 testes do harness; Linux/Node 23.11.1. MR-06 e MR-09 a MR-15 pendentes. |
| 07/11/2026 | M3 parcial / AUDIO-01, STT-02/03      | validation/ASR-INICIAL.md; decisions/ASR-LOCAL.md; tests/speech.test.ts; tests/desktop/asr.spec.ts                                      | Caminho Linux/local integrado; parciais/finais, cancelamento e nova geração cobertos. AUDIO-02, STT-01, STT-04/05 parciais; captura/modelo Windows e aceite de M3 pendentes.                                                                           |
| 07/11/2026 | M4 parcial / UI-03                    | src/renderer/NotchView.tsx; src/renderer/SettingsView.tsx; src/desktop/main.ts; tests/desktop/notch.spec.ts; validation/BASE-DESKTOP.md | Painel fecha por Escape/blur e preserva foco externo no teste Linux/X11. UI-01/02/04/05/06 têm implementação parcial; idioma configurável, atalho trocável, alto contraste e validação visual completa pendentes.                                      |
| 07/11/2026 | MR-14 parcial / mudanças de restrição | tests/constraint-shift.test.ts; validation/MR-CONSTRAINT-SHIFT.md                                                                       | Quatro testes determinísticos mantêm texto/proposta e variam política confiável; prompt injection não altera autorização. Módulo System 1/avaliação de omissões ainda não existe.                                                                      |
| 07/11/2026 | MR-06 parcial / validação de dataset  | scripts/research/validate_dataset.py; tests/research-dataset.test.ts; validation/MR-DATASET-PREP.md                                     | Validador exige consentimento, procedência, referência, hashes e splits sem vazamento; 3 testes usam linhas sintéticas temporárias. Dataset real e splits congelados ainda pendentes.                                                                  |
| 07/11/2026 | M0 / DEC-02, DEC-04, DEC-05           | decisions/M0-ESCOPO.md; validation/M0-AMBIENTE.md                                                                                       | Política de suporte e recorte registrados; Linux identificado; Windows dual boot confirmado pelo usuário; comparar remoto/local antes de decidir; DEC-01/03/06 pendentes                                                                               |

Ao encerrar uma sessão de trabalho: marcar apenas tarefas aceitas, registrar evidência e bloqueios, atualizar estimativa se houver descoberta material e indicar a próxima tarefa executável. Não iniciar M3 remoto sem DEC-03.

## Manutenção da base

Modularização inicial executada: apresentação de notch/configurações, bridge e store separados no renderer; posicionamento, segurança e autostart extraídos no desktop. Plano e mapa em [MODULARIZACAO.md](MODULARIZACAO.md). Sem alteração do escopo funcional dos marcos.
