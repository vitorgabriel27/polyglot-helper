# PolyglotHelper — arquitetura da notch flutuante

Status: proposta de arquitetura, anterior à implementação. M0 em andamento: [decisões](decisions/M0-ESCOPO.md). Harness híbrido local com escalada seletiva é a direção definida; configuração de modelos, limites e política operacional de nuvem serão escolhidos após comparação. Deepgram/DeepL são candidatos remotos, não autorização de envio. Substitui a prioridade de texto/OCR do plano inicial por legendagem de áudio. Nenhum protótipo novo nesta etapa.

## Integração da pesquisa — direção atual

O produto adotará um **harness de agentes com System 1 local, cascatas por tarefa e escalada seletiva até API em nuvem**, conforme [arquitetura de pesquisa](research/HARNESS-CASCATAS.md). Esse documento prevalece sobre a proposta anterior de inferência remota direta. Competência, autorização e disponibilidade são separadas: nenhum modelo autoriza sua própria captura, transmissão ou persistência.

Fluxo: captura autorizada → System 1/OOD e controlador → agente especialista local → modelo local maior opcional → API autorizada, com gate antes de todo efeito e budgets por segmento. Para ASR sem texto inicial, usar sinais acústicos/política explícita; TF–IDF roteia texto, não áudio bruto. Conteúdo consumido nunca é uma instrução confiável.

A comparação passa a incluir local-only, cloud-only e cascata híbrida; a decisão pendente é a configuração operacional e seus limites, não mais a adoção ou não do harness.

## Configuração inicial e captura local — atualização

Onboarding de primeira abertura, preferências persistentes e autostart opt-in implementados. Abrir no login não inicia captura. Linux usa X11/XWayland por padrão quando disponível para reforçar posição/sobreposição; Wayland nativo é experimental. Captura PipeWire conectada a worker ASR local base.en/CPU, com janelas limitadas, parciais/finais e cancelamento. [Decisão ASR e comparação Parakeet](decisions/ASR-LOCAL.md). Ver [decisão detalhada](decisions/OVERLAY-PREFERENCIAS.md).

## 1. Produto e escopo

Aplicativo desktop para **Windows e Linux**, com uma pequena notch flutuante e clicável, que expande apenas o necessário para exibir legendas e configurações rápidas. Ambos são plataformas do MVP; versões e ambientes gráficos de referência serão definidos em M0 do [roadmap](ROADMAP.md). Primeiro idioma: inglês americano, com tradução para português brasileiro.

Estados visuais:

- Recolhida: nome/indicador de estado, iniciar ou retomar ao clicar.
- Legendando: original em até duas linhas; tradução opcional abaixo; largura limitada e fonte ajustável. Fala longa substitui segmentos antigos, sem aumentar indefinidamente a janela.
- Configurando: clicar na notch abre painel ancorado com fonte (sistema/microfone), idiomas, tradução, pronúncia, tamanho e pausar/parar. Escape ou clique fora fecha o painel sem encerrar a sessão.
- Pausada: captura interrompida; retomar cria nova geração da sessão. O conteúdo de origem continua tocando.
- Erro: estado claro de fonte indisponível, permissão negada, conexão perdida ou limite atingido; ação específica de tentar novamente.

A notch precisa receber cliques. Não habilitar click-through na janela inteira por padrão. A janela deve ocupar somente a área da interface, evitando um retângulo transparente que bloqueie o desktop. Se houver modo de ignorar cliques, oferecer atalho global de recuperação e testar a região interativa. Abrir configurações pode tomar foco; acompanhar legendas não deve tomar foco repetidamente.

Posição proposta: topo central com margem configurável. Alternativa: arraste manual ou canto escolhido quando o compositor não permitir posicionamento. Duas janelas: notch e popover de configuração, com foco/fechamento coordenados.

## 2. Stack escolhida

| Camada                 | Escolha                                                                  | Responsabilidade                                                                               |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Desktop                | Electron + TypeScript                                                    | Janelas, foco, atalhos, permissões e ciclo de vida                                             |
| Interface              | React + Vite + CSS                                                       | Notch, legendas e configurações; transições CSS respeitando redução de movimento               |
| Estado                 | Máquina de estados explícita em TypeScript; Zustand para preferências/UI | Sessão controlada por eventos; UI não comanda diretamente dispositivos                         |
| Captura                | Adaptadores Windows (loopback/microfone) e Linux/PipeWire                | Validar caminho Electron e alternativa nativa por SO; sistema e microfone são fontes distintas |
| Processamento de áudio | Worker/processo utilitário + PCM mono                                    | Normalização de taxa, timestamps, buffers limitados e envio sem bloquear a interface           |
| Transcrição            | Cascata ASR local → local maior opcional → API candidata Deepgram        | System 1/controlador selecionam estágio; gate autoriza efeitos e envio                         |
| Tradução               | Cache → tradução local → API candidata DeepL/LLM                         | Modelos locais e destino remoto escolhidos por benchmark; nunca liberar nuvem só por confiança |
| Persistência           | JSON versionado e gravação atômica no diretório userData                 | Preferências apenas; sem banco no MVP                                                          |
| Ferramentas            | pnpm, ESLint, TypeScript, Vitest e Playwright                            | Tipagem, verificação de eventos, testes de interface e fluxos críticos                         |
| Distribuição           | electron-builder                                                         | Instaladores Windows e Linux; modelos e serviços não embutidos no renderer                     |

Para piloto pessoal, credenciais próprias ficam no armazenamento seguro do SO, acessadas apenas pelo processo principal; validar disponibilidade do keyring e não persistir em texto puro como fallback. Renderer recebe apenas operações específicas por preload.

Para distribuição a terceiros: gateway único em Node.js + TypeScript + Fastify, com HTTPS/WebSocket, autenticação, limites por usuário e segredos do provedor no servidor. Não distribuir uma chave compartilhada dentro do instalador. Gateway é requisito da versão distribuída, não microserviços do piloto.

O caminho local faz parte da nova entrega de pesquisa: Python + scikit-learn para treino/replay e baseline System 1; worker isolado para a referência de inferência, com faster-whisper como candidato ASR. ONNX/onnxruntime-node é alternativa de distribuição condicionada à paridade do pipeline. Modelos e thresholds não serão transplantados do artigo sem validação. Ver contratos, gate e protocolo no documento do harness.

## 3. Componentes e fluxo

Fonte autorizada → adaptador de captura → worker de áudio → STT → coordenador de segmentos → notch.

Segmento estável → adaptador de tradução → tradução com o mesmo ID → notch.

Palavra selecionada → adaptador lexical → pronúncia e significado no contexto.

Renderer → preload com métodos restritos → processo principal/coordenador → captura/provedores. Fluxo de atualização retorna por eventos tipados. Nenhum módulo de interface lê arquivos, executa comandos ou acessa chaves.

Contratos mínimos:

- AudioSource: listSources(), start(sourceId), stop(); entrega AudioChunk com sequência, timestamp e formato.
- SpeechProvider: connect(language, format), send(chunk), close(); emite TranscriptSegment.
- TranslationProvider: translate(segmentId, revision, text, source, target, context, signal).
- PronunciationProvider: lookup(word, locale); retorna IPA, variante e origem, ou indisponível.
- OverlayController: show(), setMode(), update(segment), openSettings(), closeSettings().

TranscriptSegment: sessionId, generation, segmentId, revision, startMs, endMs, text, isFinal. Traduções carregam os mesmos identificadores. Tempo de captura usa relógio monotônico; timestamps do provedor são convertidos para o início da sessão.

## 4. Regras de tempo real

- Parcial atualiza a mesma frase; não adiciona uma linha a cada token.
- isFinal encerra um intervalo de transcrição; fim de enunciado/silêncio decide quando agrupar e traduzir. São conceitos diferentes.
- Traduzir por limite de duração ou fim de enunciado, evitando esperar indefinidamente por silêncio; parâmetros definidos no benchmark.
- Cada resposta é aceita apenas se geração e revisão ainda forem atuais; tradução atrasada nunca substitui segmento mais novo.
- Pausar/parar fecha captura e stream, cancela traduções e invalida a geração. Retomar não reproduz áudio acumulado durante a pausa.
- Buffer de áudio limitado, inicialmente até 2 s antes do envio. Ao saturar ou desconectar, indicar interrupção e reiniciar o fluxo ao vivo; não acumular atraso indefinido nem remover áudio silenciosamente.
- Desligar tradução impede novas requisições. Alterar fonte ou idioma reinicia a geração. Alterar fonte visual não reinicia captura.
- Manter só contexto recente em memória; sem gravação persistente de áudio ou transcrição no MVP.

## 5. Fonética e demais recursos

Não exibir uma terceira linha permanente por padrão: legendagem mínima é original + tradução opcional. Pronúncia fica sob opção ou seleção de palavra. IPA é obtido de léxico com licença compatível; fornecedor lexical e variante precisam de decisão própria antes dessa fase. Não inventar transcrição para palavras ausentes. Aproximação PT-BR, se incluída, é rotulada como aproximada.

OCR de região, vocabulário persistente e TTS são extensões. OCR entra como produtor alternativo do mesmo contrato de segmento; não precisa atravessar o fluxo de áudio. Adotar SQLite quando houver vocabulário e histórico consultável, não apenas para salvar algumas preferências.

## 6. Segurança e permissões

Electron com contextIsolation e sandbox habilitados, nodeIntegration desabilitado; IPC validado por esquema e origem, navegação externa bloqueada e CSP restritiva. Texto de transcrição é conteúdo, nunca HTML executável. Capturar somente após ação explícita. Mostrar estado ativo e botão de parar. Informar que o modo remoto envia áudio/texto aos provedores. Logs contêm tempos e códigos de erro, sem áudio, frases ou credenciais.

## 7. Plano anterior à implementação visual

1. Definir versões de Windows e distribuição/compositor Linux de referência; aceitar ou rejeitar processamento remoto. Inspecionar hardware apenas se for necessário escolher execução local.
2. Prova técnica de janela vazia: topo, always-on-top, expansão, cliques, foco, dois monitores, escala e tela cheia. Em Wayland, posição e sobreposição dependem do compositor; se topo central for obrigatório e Electron não cumprir, avaliar integração específica do desktop/layer-shell. Não migrar framework sem essa evidência.
3. Prova de captura: registrar somente métricas e verificar sistema/microfone separadamente, troca de saída para fones e cancelamento imediato.
4. Benchmark STT/tradução com clipes controlados de voz limpa, música e fala rápida. Medir erro, p50/p95 e custo por hora pelas tarifas vigentes; nenhuma promessa de custo ou precisão antes disso.
5. Congelar contratos e decisões da plataforma. Só então desenhar e implementar a notch mínima.

Critérios iniciais: original parcial p95 ≤ 1,5 s após trecho falado; tradução p95 ≤ 3 s após fim do segmento enviado. Metas de produto a validar, não garantias do provedor. Sessão de 30 min sem crescimento contínuo de memória, sem atraso crescente e sem captura após parar. Verificação nativa de foco/compositor complementa testes automatizados.

## 8. Referências técnicas consultadas

- Electron BrowserWindow: https://www.electronjs.org/docs/latest/api/browser-window
- Click-through: https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions
- Segurança: https://www.electronjs.org/docs/latest/tutorial/security/
- PipeWire: https://pipewire.pages.freedesktop.org/pipewire/group__pw__keys.html
- Deepgram streaming: https://developers.deepgram.com/reference/speech-to-text/listen-streaming
- Deepgram finalização: https://developers.deepgram.com/docs/understand-endpointing-interim-results
- DeepL: https://www.deeplcom.com/en/api/translate-text.html
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
