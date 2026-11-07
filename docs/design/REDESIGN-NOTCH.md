# Redesign da notch inspirado na referência de letras

Status: implementação inicial no Linux concluída; validação multiplataforma e revisão visual completa pendentes. A imagem enviada serve como direção visual, não como especificação pixel a pixel.

## Direção visual

- Superfície preta em formato de cápsula/notch, com cantos bem arredondados e contraste alto.
- Estado compacto: ícone discreto de fonte/áudio, indicador de atividade e controle de pausar/retomar.
- Estado expandido: frase anterior em cinza, segmento atual em destaque claro e próximo segmento em cinza. Tradução opcional logo abaixo da frase atual, com hierarquia visual secundária.
- Expansão por clique/hover ou durante fala ativa; recolhimento sem capturar foco do aplicativo de origem.
- O painel de configurações permanece separado da área de legenda ao vivo.

## Adaptação ao PolyglotHelper

A imagem mostra letras sincronizadas à reprodução. O produto recebe áudio e transcreve fala: não tem acesso ao relógio de mídia nem às letras oficiais. Portanto, a primeira versão usará segmentos ASR recentes como anterior/atual/próximo, sem alegar sincronização por palavra. O destaque acompanha o segmento reconhecido; sincronização temporal fina depende de timestamps por palavra ou integração futura com a fonte de mídia.

Não exibir capa/nome de música sem metadados fornecidos por uma fonte autorizada. Usar ícone de áudio ou microfone, conforme fonte selecionada. Estados de espera, captura pausada, erro, tradução pendente e fonte de demonstração devem ser distintos e acessíveis.

## Etapas de implementação

1. Rever composição: cápsula preta, controles compactos, indicador de áudio e área de legenda com tipografia e espaçamento novos.
2. Projetar expansão com três posições de segmento e tradução opcional; limitar altura e definir transição para frases longas.
3. Implementar estados de hover/expansão e recolhimento respeitando foco, clique e compositor Linux/Windows.
4. Validar contraste, teclado, escala e redução de movimento; revisar screenshots nos estados compacto, expandido, espera, pausado, erro e tradução desligada.
5. Só depois avaliar destaque por palavra sincronizado, condicionado a timestamps adequados.

## Critérios de aceite

- Conteúdo atual é claramente distinguível do anterior e do seguinte; tradução não compete visualmente com o original.
- Estado compacto ocupa pouco espaço; estado expandido mostra no máximo três segmentos e limita linhas sem crescimento indefinido.
- Pausar/retomar continua acessível e captura mantém o ciclo de vida atual.
- Hover não rouba foco nem bloqueia interação com a aplicação de origem; teclado oferece caminho equivalente.
- Aparência e legibilidade verificadas nas plataformas/compositores efetivamente cobertos, sem afirmar sincronização por palavra.

## Implementação inicial entregue

A notch usa superfície preta arredondada, ícone conforme a fonte, expansão por hover e foco, segmento recente anterior em tom secundário, segmento atual destacado e linha para o próximo trecho. A tradução fica abaixo do original. O estado da sessão já limpa o histórico ao iniciar, pausar, parar ou falhar, e conserva até três segmentos finalizados durante a sessão. Não há dados de próximos segmentos antes do reconhecimento; a interface mostra um espaço reservado.

Verificação local Linux: `pnpm check` e `pnpm test:desktop` aprovados. Ainda falta inspeção visual de todos os estados e validar o comportamento de foco e posicionamento nos ambientes Windows/compositores suportados.

## Dependências e fora de escopo

Depende da estabilização do layout atual e de regras de apresentação de segmentos no renderer. Não requer chamadas em nuvem nem persistência de transcrições. Letras oficiais, identificação de músicas, capas e sincronização por palavra não fazem parte desta entrega.
