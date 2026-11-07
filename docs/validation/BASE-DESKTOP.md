# Primeira base desktop — evidências

Data: 07/11/2026. Pasta oficial: `/home/vitor-g/polyglot-project`. Branch: `main`.

Estado histórico da primeira base. A entrega atual e a correção da identificação do backend gráfico estão em [CAPTURA-PREFERENCIAS.md](CAPTURA-PREFERENCIAS.md).

## Entrega

Electron 45.2.3 + React 19.3.1 + Vite 8.3.6 + TypeScript 6.0.3, dependências fixadas e lockfile. TypeScript 6 escolhido por compatibilidade do typescript-eslint; Node 22.22.0 usado nos checks finais. Node original 22.12.0 preservado; o runtime de verificação foi obtido via npm exec.

Duas janelas sem moldura: notch e configurações. Demonstração explícita de frases com atualizações parciais/finais, pausa/retomada/parada; tradução/IPA e tamanho configuráveis em memória. Notch se ajusta à altura real via ResizeObserver e IPC de resize com limites. Atalho e tray implementados no caminho de execução normal.

Renderer com sandbox, contextIsolation, nodeIntegration desabilitado, CSP sem conexões e bloqueio de navegação/permissões/rede. Bridge expõe somente snapshot, command e subscribe, com validação de comando/origem no main. Esse controle ainda não implementa o gate autoritativo completo da pesquisa.

## Verificações realizadas

| Verificação | Resultado | Limite |
| --- | --- | --- |
| TypeScript | Passou | Não valida comportamento nativo |
| ESLint | Passou | Não substitui revisão de segurança |
| Vitest | 5 testes passaram | Geração antiga, revisão fora de ordem/pós-final, segmento antigo, stop e payload IPC inválido |
| Build Vite/esbuild | Passou | Sem instalador nesta etapa |
| Playwright Electron com flag de app X11 | Passou, backend então não comprovado | Comprovação X11/XWayland corrigida e executada no relatório atual |
| Playwright Electron Wayland nativo | Passou | Desktop/compositor atual apenas |
| Screenshot da notch | Inspecionado | Demo com original, tradução e IPA; não representa todos os tamanhos/monitores |
| Windows nativo | Não executado | Adiado pelo usuário para clone e validação futura |
| Workflow GitHub Windows/Linux | Preparado | Ainda não executado em servidor remoto |

O teste desktop abre notch/configurações, inicia e pausa/retoma fixtures, ativa IPA, fecha painel por Escape, verifica isolamento de Node no renderer, API pública mínima e rejeição de comando arbitrário. A escolha da página é pela URL, sem assumir ordem de abertura entre janelas.

## Pendências reais

- Captura de áudio, ASR, tradução real e harness/System 1 não conectados.
- Preferências persistentes e armazenamento de credenciais não implementados.
- Validar tray/atalho manualmente, cliques fora da área da notch, foco sobre outro app, monitores com escalas distintas e fullscreen.
- Topo central/always-on-top no Wayland continua condicionado ao compositor; screenshot e teste de UI não demonstram posicionamento global.
- Windows: executar instalação das dependências, checks e teste nativo após clone; não copiar node_modules.
- Instaladores e gateway remoto são etapas posteriores.

A origem antiga foi preservada durante a migração; não é mais a pasta de trabalho oficial. Nenhum remote Git foi configurado nem publicação realizada nesta entrega.
