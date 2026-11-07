# PolyglotHelper — plano inicial

> A direção atual é a notch mínima com legendagem de áudio primeiro. Consulte [a arquitetura e a stack atualizadas](ARQUITETURA.md). As prioridades abaixo registram a proposta inicial e foram substituídas onde houver divergência.

## Objetivo e hipótese

Transformar conteúdo que a pessoa já consome em aprendizado de idiomas sem interromper sua atividade. Validar se original + tradução opcional + apoio de pronúncia melhora compreensão sem distrair.

Nome definido: PolyglotHelper. Primeira combinação proposta: inglês americano → português brasileiro. Espanhol no protótipo serve para explorar a troca de idioma; implementação real começa com um par.

## Fluxo do produto

1. Escolher idioma de aprendizado, idioma da tradução e fonte: região da tela ou áudio.
2. Autorizar somente a fonte escolhida e iniciar uma sessão; exibir indicador de captura e ação de parar.
3. Ver janela compacta sobre o conteúdo, com original e tradução/IPA opcionais.
4. Alternar entre acompanhar (cliques passam para o aplicativo abaixo) e estudar (interagir com as palavras).
5. Selecionar uma palavra, consultar significado no contexto e salvar junto da frase.
6. Encerrar a captura; revisar somente o vocabulário salvo explicitamente.

Separar idioma do conteúdo e idioma que se deseja praticar: no primeiro MVP o conteúdo já está no idioma de aprendizado. Traduzir áudio em português para inglês é outro modo, posterior.

## Recorte do MVP

Primeiro: janela sobreposta + texto obtido de uma região escolhida + inglês → português + IPA da palavra + vocabulário local. Usar copiar/colar como entrada provisória enquanto se valida OCR. Capturar só sob comando inicialmente, evitando custo e ruído de OCR contínuo.

Depois: captura de áudio, detecção de fala, transcrição incremental e tradução por segmentos. Vídeos usam esse mesmo fluxo de áudio; OCR é reservado a texto visível. Não extrair áudio de legendas com OCR quando já houver áudio disponível.

Fora da primeira entrega: tradução universal de toda a tela, todos os idiomas, aplicativo móvel, avaliação de sotaque e sincronização entre dispositivos. O objetivo final continua sendo acompanhamento automático; o recorte reduz as incertezas de cada etapa.

## Fases e critérios de saída

| Fase                | Entrega                                                                        | Como aceitar                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Experiência         | Protótipo com exemplos                                                         | Testar com 3–5 pessoas: escolher fonte, entender frase e salvar palavra sem orientação; registrar distração e preferências |
| Viabilidade desktop | Janela sobreposta + atalho para interagir + captura de região e áudio por 60 s | Validar no SO/compositor real, dois monitores, escala e janela cheia; documentar combinações sem suporte                   |
| Texto funcional     | OCR por comando, tradução e consulta fonética                                  | Amostra de 30 capturas variadas; registrar erros de OCR, tradução e tempo total; nenhuma recaptura do próprio overlay      |
| Áudio funcional     | Transcrição e tradução por segmentos                                           | Sessões de 10 min; medir atraso p50/p95, revisões e perdas; meta inicial p95 ≤ 3 s após fim do segmento, a validar         |
| Aprendizado         | Salvar, consultar e excluir vocabulário                                        | Persistir localmente, evitar duplicatas por idioma e recuperar após reiniciar                                              |
| Piloto              | Instalador no SO escolhido e diagnóstico                                       | Sessão contínua de 30 min; sem captura após parar; custo por hora e uso de CPU/RAM registrados                             |

Sem estimar datas antes da prova de captura/sobreposição: essa é a principal incerteza técnica.

## Arquitetura proposta

Electron + TypeScript para o aplicativo desktop; UI de configurações e janela de overlay separadas. Proposta a confirmar na prova de viabilidade, antes de implementar toda a interface.

Texto: região autorizada → captura → detecção de mudança → OCR → normalização → tradução contextual → overlay.

Áudio: fonte autorizada → buffers com timestamps → detecção de voz → transcrição parcial/final → tradução de segmentos estáveis → overlay.

Um coordenador mantém sessões e IDs de segmentos, descarta respostas atrasadas, cancela tarefas ao parar e evita que uma frase antiga substitua a atual. A tradução deve preservar sentido de expressões; definições por palavra ficam separadas da tradução da frase.

Adaptadores separados para captura, OCR, transcrição, tradução e léxico permitem testar serviços remotos ou execução local sem reescrever a interface. Escolher fornecedores com uma amostra real de áudio/texto e medição de qualidade, atraso e custo, sem fixar preço nesta etapa. Segredos ficam fora do renderer; chamadas pagas em produção passam por serviço autenticado com limites de uso.

Pronúncia: IPA associado ao idioma e variante, preferencialmente de fonte lexical com licença compatível. Fala conectada requer tratamento próprio. Aproximação PT-BR é auxílio opcional e explicitamente aproximado; não derivar fonética da tradução. TTS e repetição lenta vêm depois; pausar o assistente não deve sugerir que o vídeo original também pausou.

## Modelo mínimo

- Session: id, idioma de origem, idioma de tradução, fonte, estado e horários.
- Segment: id, sessionId, início/fim, texto original, tradução, estado parcial/final e versão.
- VocabularyEntry: idioma, forma, significado contextual, frase original, IPA/variante e data; salvar sem duplicar por idioma/forma.
- Settings: idiomas, pronúncia, tamanho, posição e visibilidade da tradução.

Capturas e áudio brutos são temporários por padrão. Não registrar conteúdo bruto em logs; guardar frases apenas quando a pessoa as salvar. Descrever envio para serviços remotos antes de ativar e permitir apagar o vocabulário.

## Riscos que a prova técnica precisa resolver

- Linux/Wayland: controle de posição/foco da janela é limitado. Não prometer overlay universal antes de testar o compositor real. X11 pode ser uma alternativa de piloto se necessário. [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window).
- Captura varia por SO, permissões e servidor de exibição; no Linux/PipeWire a seleção de fontes tem particularidades. Testar áudio do sistema separadamente do microfone. [desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer).
- Alternância entre ignorar cliques e interagir deve sempre ter saída por atalho. [Interações de janela](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions).
- Conteúdo protegido e algumas telas cheias podem impedir captura ou overlay. Exibir estado de indisponibilidade e oferecer seleção de outra fonte.
- Recapturar o próprio overlay pode produzir tradução em cascata. Excluir sua janela ou ocultá-la durante a captura quando necessário.
- Áudio contínuo tem custo e revisões; enviar segmentos com limites e cachear traduções repetidas. Erros de rede devem manter último resultado identificado como anterior e permitir retomar.

## Próxima decisão

Confirmar o sistema operacional da primeira versão e se a prioridade é vídeo/áudio ou leitura. O ambiente desta pasta sugere Linux; isso é uma hipótese, não uma decisão do usuário. Em seguida executar a prova de viabilidade nesse ambiente antes de ampliar a implementação.
