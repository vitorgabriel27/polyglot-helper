# M0 — decisões de escopo e suporte

Data: 07/11/2026. Status: parcialmente concluído. Referência: [roadmap](../ROADMAP.md).

## Atualização de escopo: pesquisa aplicada

O usuário solicitou harness de agentes, cascatas de ML, System 1 local e escalada seletiva para API. A arquitetura híbrida está definida como direção; modelos, limiares, permissão operacional de nuvem e orçamento continuam pendentes de comparação. Ver [especificação e protocolo](../research/HARNESS-CASCATAS.md). O pedido de documentação não ativa captura nem transmissão.

## Decisão de execução posterior

O usuário autorizou iniciar a implementação no Linux e preparar Windows sem validação nativa agora; fará clone e correções no Windows depois. DEC-01/06 permanecem parcialmente pendentes, mas deixam de bloquear tarefas independentes de janela/base compartilhada. Não inspecionar partições nem reiniciar o computador. Não marcar testes Windows concluídos por preparação de código/CI. Pasta oficial alterada para `/home/vitor-g/polyglot-project`; branch `main`.

## Decisões registradas

| ID | Decisão | Situação |
| --- | --- | --- |
| DEC-01 | Windows e Linux são plataformas do MVP. Linux de referência: Ubuntu 26.04.1 LTS x64, GNOME 50.1, Wayland. Windows no mesmo computador via dual boot; versão e arquitetura a verificar. | Parcial |
| DEC-02 | Priorizar teste nativo no Wayland disponível e no Windows do dual boot. X11 será experimental e só entra na matriz validada se houver sessão acessível. Nenhuma plataforma é anunciada como suportada antes de passar M1 e M6. | Concluída |
| DEC-03 | O usuário prefere decidir processamento após comparar custo e desempenho. Até lá: provedores simulados, sem envio de áudio e sem contratação de serviços. Protocolo de comparação abaixo. | Pendente de comparação e escolha |
| DEC-04 | Inglês americano → português brasileiro na primeira entrega; original + tradução opcional, pronúncia sob seleção/opção. Idiomas configuráveis na arquitetura. | Concluída como recorte inicial reversível |
| DEC-05 | Notch mínima, topo central preferencial, até duas linhas de original, painel rápido ao clicar; sem dashboard permanente. Posição alternativa manual/canto é fallback proposto, condicionado ao resultado da prova Wayland e à avaliação do usuário. | Concluída como requisito inicial; fallback não garante viabilidade |
| DEC-06 | Linux disponível e identificado. Usuário confirmou Windows em dual boot neste mesmo computador, mas acesso por esta sessão e execução nativa ainda não verificados. | Parcial |

## Atualização da política gráfica

Para atender à sobreposição solicitada, X11/XWayland passa a ser o backend padrão no GNOME Wayland quando DISPLAY existir; Wayland nativo fica experimental. Isso não exige mudar a sessão do usuário. Ver [decisão atual](OVERLAY-PREFERENCIAS.md). A matriz abaixo distingue sessão X11 nativa de backend XWayland dentro da sessão Wayland.

## Matriz de suporte planejado

| Ambiente | Arquitetura | Disponibilidade | Política | Validação atual |
| --- | --- | --- | --- | --- |
| Ubuntu 26.04.1 / GNOME 50.1 / Wayland | x64 | Sessão atual acessível | Alvo principal Linux | Ambiente identificado; notch/captura ainda não testadas |
| Windows do dual boot, versão pendente | A confirmar | Existência informada pelo usuário | Alvo principal Windows | Identificação e execução pendentes |
| GNOME Wayland + backend XWayland | x64 | Disponível nesta sessão | Backend padrão para overlay | Janela e ordem de sobreposição testadas; cenários ampliados pendentes |
| Sessão Linux X11 nativa | A confirmar em ambiente de teste | Sessão X11 não encontrada no diretório padrão desta instalação | Experimental | Não testado |
| Outros desktops/distribuições Linux | Não definido | Não verificada | Fora da garantia inicial | Não testados |
| Windows/Linux ARM64 | ARM64 | Não verificada | Fora do piloto inicial, salvo evidência de que o Windows alvo seja ARM64 | Não testados |

Windows não é substituído por Wine, cross-build ou CI: esses caminhos ajudam a compilar, mas não validam áudio, foco, escala ou tela cheia. Dual boot exige reiniciar; testes de áudio/foco não devem ser declarados simultaneamente executados nas duas plataformas.

## Escopo fechado do piloto

- Capturar saída de áudio do sistema OU microfone, sem misturar as fontes inicialmente.
- Exibir transcrição incremental e tradução opcional em notch clicável.
- Abrir configurações rápidas, pausar, retomar e parar sem tela principal.
- Incluir pronúncia opcional sem ocupar uma terceira linha por padrão.
- Entregar instalador Windows e pacote Linux após testes nativos.
- Sem OCR, conta/sincronização, vocabulário persistente ou avaliação de sotaque nesta entrega.

Configuração de idioma é requisito; en-US → pt-BR é a combinação de aceitação inicial, não limitação permanente do modelo de dados.

## Comparação obrigatória antes de DEC-03

Comparar três opções no mesmo conjunto de clipes autorizados: (A) serviço remoto de STT + tradução; (B) STT local + tradução local; (C) harness híbrido com System 1, cascatas e gate. Não chamar uma opção de offline se a tradução continuar remota.

1. Preparar pelo menos 10 minutos de áudio com referência escrita: fala limpa, rápida e com ruído/música. Mesmos trechos e parâmetros de medição nas duas opções.
2. Registrar CPU, RAM e GPU disponível para selecionar modelo local; não escolher tamanho do modelo antes disso.
3. Medir STT separadamente da tradução: erro de palavras, tradução contextual de 30 frases, latência p50/p95, CPU/RAM/VRAM, tamanho de download e estabilidade por 30 min.
4. Consultar tarifas oficiais na data da comparação e registrar moeda, plano e unidade. Custo remoto/h = minutos faturados × tarifa/minuto + caracteres traduzidos × tarifa/caractere + outros custos aplicáveis. Créditos promocionais ficam separados do custo recorrente.
5. No local, registrar custo de hardware adicional, se houver, e energia somente se medida/estimada com premissas explícitas; custo de API zero não significa custo operacional zero.
6. Comparar Windows e Linux com modelos equivalentes; registrar dependências de GPU e instalação.
7. Apresentar tabela com evidências e recomendação; usuário escolhe modo e teto financeiro antes de ativar uso recorrente.

Sem autorização de envio ainda registrada, comparação inicial é documental e com medições locais; teste remoto com áudio requer autorização específica do conjunto de amostras. Credenciais não devem ser colocadas no chat nem no repositório.

Modelo de resultado:

| Critério | Remoto | Local | Híbrido |
| --- | --- | --- | --- |
| Modelo/versão e data | A medir | A medir | A medir |
| STT p50/p95 e erro de palavras | A medir | A medir | A medir |
| Tradução p50/p95 e avaliação das 30 frases | A medir | A medir | A medir |
| CPU/RAM/VRAM | A medir | A medir | A medir |
| Custo recorrente/h e premissas | A calcular | A calcular | A medir |
| Internet/dados enviados | Documentar política do provedor | Confirmar execução totalmente local | A medir |
| Instalação nos dois SOs | A validar | A validar | A medir |

## Pendências para fechar M0

1. No Windows, informar edição/versão/build e tipo de sistema em **Configurações → Sistema → Sobre**, e confirmar que consegue abrir o projeto nesse boot. Alternativamente, executar os comandos de identificação do relatório de ambiente.
2. Realizar comparação local-only/cloud-only/híbrido e registrar configuração de cascata e política operacional de nuvem; credenciais/teto são necessários apenas se o caminho remoto for escolhido.
3. Atualizar DEC-01, DEC-03 e DEC-06 no roadmap com evidências, sem marcar o marco inteiro concluído antes disso.

Próxima tarefa executável independente: WIN-01/LIN-01 (janela técnica sem áudio) e preparação da comparação. Provas de áudio usam apenas captura local explicitamente iniciada; nenhum provedor remoto é ativado por padrão.
