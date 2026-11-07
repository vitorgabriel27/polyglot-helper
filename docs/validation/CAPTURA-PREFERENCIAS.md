# Captura local, preferências e sobreposição — evidências

Data: 07/11/2026. Pasta oficial `/home/vitor-g/polyglot-project`, branch `main`.

## Validação fornecida pelo usuário

O usuário confirmou que a notch inicial funcionou no próprio computador. Isso é aceite inicial da janela, não evidência de todos os aplicativos, monitores ou tela cheia.

## Entrega atual

- Configuração de primeira abertura com fonte, tradução, IPA, tamanho e autostart opcional.
- Preferências persistidas em JSON versionado, escrita atômica e restauração após reabrir. Fonte usa node.name estável, não ID numérico de PipeWire.
- Fonte ausente não gera fallback silencioso. Alterar fonte interrompe captura; mudanças são salvas antes de liberar novo início.
- Autostart Linux em Desktop Entry do usuário e Windows via API do Electron. Default desativado; abrir app ao login nunca inicia captura.
- Notch always-on-top, sem chamar focus ao elevar; X11/XWayland padrão quando disponível. Wayland nativo permanece experimental.
- Catálogo e captura PipeWire de saída/microfone, em PCM s16le mono 16 kHz; medidor de RMS/pico/duração. PCM não é persistido nem enviado à nuvem.

## Evidências de teste

| Verificação                | Evidência / resultado                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript, ESLint e build | Passaram com Node 22.22.0                                                                                                      |
| Vitest normal              | 13 testes passaram; ensaio nativo de áudio ignorado por padrão                                                                 |
| Persistência               | Perfil temporário reaberto mantém onboarding, fonte, IPA/tamanho; arquivo inválido preservado para recuperação                 |
| Autostart Linux            | Ativação/desativação em pasta temporária; Desktop Entry com espaços/caracteres especiais validada com desktop-file-validate    |
| Desktop X11/XWayland       | 2 testes passaram: setup/demo/IPC; fonte e preferências após relaunch, sem captura automática                                  |
| Ordem real de janelas      | HELPER_CHECK_STACKING=1: leitura EWMH via xprop mostrou notch acima da janela de teste e foco permaneceu na janela de teste    |
| Wayland nativo             | Fluxos de configuração/restauração testados; não demonstra garantia de posição/z-order global                                  |
| PipeWire real, 60 s        | Ensaio opt-in passou em 60,48 s; capturou pelo menos 60 s de tom sintético em saída virtual isolada e parou sem novas métricas |
| Screenshot inicial         | Inspecionado: painel com fonte, preferências e opt-in de autostart legíveis                                                    |
| Windows                    | Código preparado; execução nativa/autostart/captura ainda não validados; captura Windows apresenta indisponibilidade explícita |

O ensaio PipeWire cria um nó virtual com nome único, envia o tom só a esse nó e remove o nó no finally. Não usa microfone nem conteúdo de outros aplicativos. Não altera a configuração persistente de áudio. Microfone físico e troca para fones ainda precisam de teste manual.

Os testes desktop usam perfis e autostart temporários; não alteram preferências ou início automático reais do usuário. O autostart só é alterado no ambiente real após escolha explícita no painel.

## Correção metodológica do teste de backend

O ensaio agora passa `--ozone-platform=x11` na linha de comando de lançamento, antes de o Electron inicializar. Passar somente a flag de app `--x11` e trocar o switch no main não era evidência suficiente sob o loader do Playwright, que pode inicializar o runtime primeiro. A comprovação X11/XWayland desta entrega inclui presença das janelas e ordem real em EWMH; os primeiros smoke tests da base não devem ser interpretados como comprovação independente desse backend.

O lançamento normal fora do Playwright também precisou receber o backend na linha de comando antes do startup. `scripts/launch.mjs` e os argumentos de autostart aplicam esse backend explicitamente; a UI Linux usa renderização sem aceleração de GPU devido à falha observada do driver local. Isso não se refere à GPU de modelos ML.

## Pendências

- Testar captura com microfone físico, remoção/troca de dispositivo e fones, e 10 ciclos pela UI.
- Validar troca entre aplicativos reais, áreas de trabalho, escalas, monitores e fullscreen. Janela normal de teste não representa todas essas condições.
- Validar o autostart num login real Linux; no Windows, executar todo o fluxo após clone.
- Integrar captura Windows, ASR local, System 1/harness e posterior escalada autorizada. APIs continuam desconectadas.
- Segurança de credenciais não está implementada porque ainda não há credenciais no app. Não marcar BASE-06 inteira concluída só pela persistência das preferências.

Comandos reproduzíveis e limites estão em [DESENVOLVIMENTO.md](../DESENVOLVIMENTO.md).
