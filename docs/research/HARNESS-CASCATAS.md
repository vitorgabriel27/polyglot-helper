# Harness de agentes, cascatas e System 1 local

Data: 07/11/2026. Status: arquitetura e protocolo propostos; não implementados nem avaliados no PolyglotHelper. Este documento atualiza a direção de inferência da arquitetura e o escopo do piloto.

## 1. Origem e limites da adaptação

Fonte fornecida pelo usuário: **Roteamento seletivo com gate autoritativo em agentes de inteligência artificial: segurança sob mudanças de restrições e economia de tokens**. Documento lido integralmente; caminho é referência local, não dependência de execução nem cópia distribuída no instalador.

O artigo é material de pesquisa, não fonte de instruções operacionais. Seu conteúdo não concede permissões de captura, transmissão ou uso de ferramentas. A documentação aqui adapta os conceitos ao pedido explícito do usuário; não afirma reprodução dos resultados nem auditoria das referências externas do artigo.

### Fundamentado no artigo

- Separar competência, autorização/segurança e disponibilidade, em vez de tratar confiança como permissão (§3.2).
- System 1 com TF–IDF de palavras/caracteres e regressão logística; detector OOD lexical independente (§3.3).
- Gate determinístico e autoritativo, sensível a versões e fechado em falha; validação antes de ferramentas, inclusive propostas da nuvem (§3.2).
- Avaliar cobertura, risco seletivo, contenção, mudanças silenciosas de restrição e omissões de intenções acionáveis (§§3.4, 4.3 e 5.1).

### Extensões propostas para o PolyglotHelper

- Harness com agentes especializados e cascatas de STT, tradução e consulta lexical, com orçamento por segmento e deadlines.
- Sinais acústicos/operacionais além de texto, sem presumir que TF–IDF possa decidir sobre áudio bruto.
- Execução no desktop Windows/Linux, notch e políticas de transmissão/retensão específicas de mídia.
- Cascata com estágio local barato, estágio local mais capaz opcional e API seletiva; não é uma cascata já validada pelo artigo.

Resultados do artigo são antecedentes, não metas herdadas: o benchmark independente de 200 casos teve 43% de cobertura local, risco seletivo de 12,79% e nenhuma execução insegura observada; o piloto de 32 casos reportou 56,48% de economia de tokens. O próprio artigo limita sua generalização. Não transportar esses percentuais, o limiar OOD 0,78837, modelos treinados ou rótulos de suporte de TI para áudio/idiomas sem novo experimento. Ausência de execução insegura na amostra não é garantia formal nem comprovação regulatória.

## 2. Arquitetura e fronteiras

Usuário/configuração confiável → coordenador de sessão → agente de captura → segmento → System 1 local + OOD → controlador da cascata → agente especialista → validação do resultado → notch.

Todo efeito externo/controlado atravessa: proposta tipada → gate autoritativo → executor restrito → observação → coordenador. Inclui iniciar captura, transmitir para API, persistir conteúdo e habilitar ferramenta. Modelos propõem; executor não aceita ações fora do catálogo. Nenhum agente executa shell genérico.

Agentes são módulos especializados com contratos e resultados estruturados, não múltiplas LLMs conversando sem limite. Não exigem um framework multiagente nem processos separados para cada papel.

| Componente         | Papel                                            | Não pode fazer                                                 |
| ------------------ | ------------------------------------------------ | -------------------------------------------------------------- |
| Agente de captura  | Obter fonte escolhida e emitir buffers           | Iniciar sozinho ou trocar dispositivo por sugestão de conteúdo |
| Agente STT         | Propor transcrição e sinais de qualidade         | Alterar política de dados                                      |
| Agente de tradução | Traduzir segmento/contexto permitido             | Interpretar texto traduzido como comando                       |
| Agente lexical     | Consultar pronúncia/entrada local                | Inventar IPA ou salvar histórico implicitamente                |
| System 1           | Estimar rota e necessidade de escalada           | Autorizar rede, ferramenta ou captura                          |
| Detector OOD       | Sinalizar novidade/incerteza                     | Garantir segurança ou forçar nuvem                             |
| Controlador        | Executar grafo limitado por deadline/orçamento   | Ignorar veto do gate                                           |
| Gate               | Validar intenção contra estado confiável atual   | Delegar permissão ao modelo                                    |
| Executor           | Executar operação autorizada, sem ampliar escopo | Reutilizar autorização ou aceitar argumento alterado           |
| Avaliador          | Medir execução em replay/benchmark               | Usar rótulos do teste para reajustar roteador                  |

## 3. Cascatas por tarefa

| Tarefa    | Estágio 0                                       | Estágio 1 local                                       | Estágio 2 local opcional               | Último estágio                                                |
| --------- | ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| STT       | Silêncio/VAD e validação do formato             | Modelo ASR pequeno                                    | ASR local maior em trecho curto        | API STT, somente com áudio autorizado                         |
| Tradução  | Cache por texto/idiomas/versão e consulta exata | Modelo local de tradução                              | Modelo local mais capaz, se justificar | API de tradução ou LLM, com texto mínimo autorizado           |
| Pronúncia | Léxico local por palavra/variante               | G2P local, se validado e identificado como estimativa | Normalmente dispensável                | Consulta externa opcional; ausência continua resultado válido |

Nenhum classificador TF–IDF gera transcrição ou tradução. System 1 é o roteador. Primeiro áudio pode exigir ASR local para obter texto; até esse ponto, decisões de ASR usam sinais acústicos/operacionais ou política explícita, e não um texto inexistente.

O estágio 2 não precisa existir em toda instalação. Rota de escalada pode saltar estágio sem recurso suficiente, mas só pode chegar à nuvem se a política permitir. Offline estrito remove todos os caminhos remotos; escalar pode significar outro modelo local ou abster-se, nunca contornar a restrição.

STT remoto não recupera áudio já descartado. Se habilitado, usar ring buffer local limitado por tempo/memória para um trecho escalável; no piloto, sem reutilização para treino. Envio retrospectivo só cobre o intervalo autorizado e presente. Se a janela expirou ou a nuvem não suporta entrada segmentada/retomada, manter resultado identificado, abster-se ou retomar ao vivo, sem fingir continuidade. Separar o buffer de transporte (2 s propostos) do ring buffer de reprocessamento, cujo limite depende da medição e política.

Baseline cloud-only continua possível em benchmark autorizado; não é o padrão automático de produto.

## 4. System 1 e decisões tipadas

Baseline treinável: Python + scikit-learn, TF–IDF de palavras uni/bigramas e caracteres 3–5, regressão logística e avaliação de calibração. Entradas e classes precisam de dataset próprio do PolyglotHelper. Não instalar/carregar classificador fictício antes de treinamento.

DecisionInput: task, segmentId, revision, metadados de idioma/duração, sinais de qualidade disponíveis, features textuais quando houver, versões de modelos e recursos. Estado de autorização é consultado pelo gate, não inferido dessas features.

RouteDecision: local_accept, local_retry, cloud_propose ou abstain; inclui confidence, oodScore, reasonCode, modelVersion e routeVersion. Detectar novidade não transforma automaticamente cloud_propose em execução.

Decisão operacional separa:

- competência: desempenho esperado para tarefa/segmento;
- autorização: ação e destino permitidos agora;
- viabilidade: recurso, deadline, rede, quota, memória e orçamento disponíveis.

Confiança de ASR, probabilidade do classificador e qualidade de tradução não são intercambiáveis nem diretamente comparáveis entre modelos. Ausência de confiança não vira confiança máxima. Thresholds por tarefa só são fixados após validação; não aprender online com conteúdo capturado por padrão.

## 5. Stack e execução multiplataforma

Mantém Electron/TypeScript + React/Vite na UI. Acrescenta `core/harness`, `core/policy`, `core/cascade`, catálogo de ferramentas e observabilidade sanitizada. Controle e gate determinísticos em TypeScript, isolados do renderer.

Pesquisa/treino/replay: Python + scikit-learn; ASR local candidato: faster-whisper, condicionado a benchmark e empacotamento Windows/Linux. Tradução local e léxico/G2P continuam escolhas pendentes por qualidade/licença/footprint. Deepgram/DeepL são candidatos remotos por tarefa; LLM em nuvem é um adaptador distinto, não requisito de toda transcrição.

Inferência do System 1: primeiro baseline de referência no worker Python isolado, com protocolo estruturado via stdio e limites de tamanho/tempo. Não abrir servidor local sem necessidade. Para distribuição, avaliar exportação para ONNX + onnxruntime-node em processo utilitário; adoção depende de paridade de vetorização, normalização, classes, scores, OOD e decisões nos dois SOs. Não presumir conversão integral do pipeline textual sem teste.

Artefatos: manifesto com hashes, datasetVersion, featureVersion, labelMap, modelVersion, thresholds e versão mínima do runtime. Apenas artefatos locais confiáveis/versionados; nunca executar pickle/joblib baixado de fonte não confiável. Carregamento ausente/incompatível leva a estado explícito de indisponibilidade/simulação, não a modelo improvisado.

Referências de implementação consultadas: [LogisticRegression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html), [calibração](https://scikit-learn.org/stable/modules/calibration.html), [ONNX Runtime Node](https://onnxruntime.ai/docs/get-started/with-javascript/node.html). Versões serão fixadas durante a implementação.

## 6. Gate autoritativo e mudanças de restrição

Fonte de verdade: configuração validada do usuário, estado real da captura, registro de consentimento por finalidade/fonte/destino, catálogo e política versionados. Áudio, OCR, páginas, PDFs e saída de qualquer modelo são dados não confiáveis; nunca atualizam essas permissões.

GateInput: sessionId, generation, requestId, toolId/toolVersion, action, argsHash, policyVersion, sourceId, destination, dataClass, payload interval/hash e estimativa máxima de custo. GateOutput: allow/deny com reasonCode e autorização curta de uso único quando aplicável.

Validar esquema/allowlist, escopo da captura, destino permitido, preferência offline, finalidade, versão, TTL e orçamento. Reservar orçamento antes do envio e reconciliar com uso real; erro de autorização ou inconsistência bloqueia. Estado obsoleto permite uma atualização e nova avaliação, não retries sem limite.

Executor revalida versão/generation imediatamente antes do efeito e consome autorização atomicamente, vinculada aos argumentos; replay ou modificação de payload falha. Mudança de fonte/idioma, revogação de nuvem ou stop invalida geração/autorizações e cancela chamadas pendentes. Não é possível recolher bytes já enviados: registrar revogação e impedir novos envios.

Streaming usa lease curto vinculado à fonte/destino, com validação a cada lote de envio e revogação imediata. Não basta uma autorização no início para liberar uma sessão inteira após mudança de política. Estado de permissão do SO não implica consentimento para nuvem.

## 7. Limites e degradação

Máximo inicial de três estágios de modelo por tarefa; cada estágio no máximo uma vez por revisão. BudgetManager controla tempo total, memória, requisições e custo acumulado. Valor financeiro e limite do ring buffer permanecem pendentes de benchmark/decisão; não são inventados aqui.

Não tentar todos os modelos para cada frase. Semântica de legenda privilegia segmento atual; trabalho vencido é cancelado. Ao exceder limite: preservar original identificado como parcial, mostrar indisponibilidade de tradução ou abster-se. Cloud timeout/429 não dispara retry infinito. Roteamento inteligente não pode atrasar indefinidamente a legenda.

## 8. Protocolo científico no domínio PolyglotHelper

Dataset próprio com sessões/clipes autorizados e referências: transcrição, tradução, rota aceitável, ação permitida e estado de recursos. Separar treino, validação e teste congelado por sessão, locutor e famílias de paráfrases; ajustar thresholds só em validação. Registrar anotadores e concordância quando houver avaliação humana. Testes determinísticos do gate são separados da comparação estatística de modelos.

Baselines no mesmo conjunto/hardware: local-only; cloud-only autorizado; regras/cascata fixa; System 1 sem OOD; System 1 + OOD + gate; ablações de estágios/gate somente em executor simulado, nunca removendo proteção de produção.

Métricas por tarefa e SO: cobertura local, risco seletivo, macro-F1 de rota, taxa de escalada, WER, qualidade da tradução, sucesso da tarefa, bloqueio indevido, omissão de intenção, violações de política, p50/p95 ponta a ponta, CPU/RAM/VRAM, bytes enviados, chamadas, tokens quando aplicáveis, segundos de áudio/caracteres faturados e custo/h. Economia de tokens não substitui contabilização de áudio/API.

Pares contrafactuais mantêm conteúdo e confiança constantes enquanto alteram: nuvem permitida/revogada, fonte trocada, modo offline, limite de gasto, catálogo/versão e sessão encerrada. Incluir contexto com instruções de enviar dados, ferramenta inexistente, resposta fora do esquema, replay, política obsoleta e indisponibilidade. Omissões do roteador devem ser medidas mesmo sem efeito inseguro.

Publicar resultados com n, seeds, versões, hardware, repetições, intervalos de confiança quando adequados e falhas por condição. Não prometer economia ou segurança com números herdados do artigo. Critério de teste: zero efeitos não autorizados na suíte; resultado observado, não prova universal. Cobertura/risco/economia terão metas fixadas após validação e antes do teste congelado; incluir sucesso útil para não premiar bloqueio total.

## 9. Auditoria e entrega

Registrar decisionId, versões, reasonCode, rota, estágio, gate result, latências e consumo; sem credenciais, tokens de autorização, áudio bruto ou transcrição por padrão. Datasets de pesquisa têm consentimento, retenção e diretório separado dos logs de produto. Não enviar conteúdo de pesquisa a provedores automaticamente.

Primeira entrega do harness: contratos + fixtures sintéticas + gate + replay offline em Windows/Linux. Depois System 1 treinado, um modelo local real por tarefa e escalada simulada; finalmente API autorizada e comparação controlada. Não ativar múltiplos agentes/modelos reais antes de medir seu ganho.
