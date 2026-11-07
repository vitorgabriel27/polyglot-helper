# Executar PolyglotHelper

Pasta oficial: `/home/vitor-g/polyglot-project` · branch `main`.

## Requisitos e comandos

Node 22.22.0 (ou LTS posterior compatível), pnpm 11.25.0 e sessão gráfica. Instalação e primeiro download do Electron precisam de internet; execução atual não chama APIs.

```sh
cd /home/vitor-g/polyglot-project
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

`dev` gera build e abre o Electron, sem hot reload. Com uma instância já aberta, uma nova execução apenas reabre suas configurações; para carregar código atualizado, use Sair antes de executar novamente. Fechar o painel pelo sistema apenas o oculta; fechar a notch encerra o app e sua captura/inferência antes de liberar a instância. Feche pelo botão Sair e execute novamente após mudanças. `.nvmrc` indica a versão de Node. No ambiente original Node 22.12 foi preservado e os checks usam `npm exec --yes --package=node@22.22.0 -- pnpm check`.

O launcher aplica as flags do backend antes de iniciar o Electron. Linux usa renderização sem aceleração de GPU por padrão para esta interface pequena (o driver local apresentou falhas); `--enable-gpu` permite um ensaio explícito posterior. Isso não desativa a GPU de futuros workers de ML. Linux usa X11/XWayland quando disponível para posicionamento/sobreposição, mesmo em sessão GNOME Wayland. `pnpm dev:x11` solicita explicitamente esse backend. Wayland nativo é experimental: após build, `pnpm start --wayland`. O compositor pode limitar posição e sobreposição; o app não rouba foco continuamente para tentar contornar isso.

Para captura local Linux: PipeWire e WirePlumber ativos, comandos `pw-dump` e `pw-record` disponíveis (normalmente pacote pipewire-bin no Ubuntu). Dependências ausentes geram erro visível e permitem continuar na demonstração.

## Primeira abertura e uso

1. Escolher demonstração, microfone ou saída de áudio em Fonte de áudio.
2. Escolher tradução, IPA, tamanho e se quer abrir ao entrar no sistema.
3. Clicar Salvar e continuar. A próxima abertura recupera essas escolhas sem repetir o painel.
4. Clicar ▶ para iniciar a demonstração ou a captura escolhida. Captura não começa só porque o app abriu no login.
5. Clique no nome da notch para alterar preferências; use Salvar para aplicar. Trocar fonte interrompe a captura atual.

A captura local Linux agora pode gerar **transcrição real em inglês**, com reconhecimento local base.en/CPU. A tradução local em português aparece abaixo do original quando a opção Tradução está ativa. IPA para áudio e harness de pesquisa ainda não conectados. Nenhum áudio é gravado em arquivo ou enviado à nuvem.

Antes do primeiro uso de transcrição, instale uv e prepare o ambiente/modelo:

```sh
pnpm setup:local
pnpm dev
```

O setup cria `.asr-venv` (Python 3.11), instala dependências fixadas e baixa ASR (~145 MB) e tradução inglês → pt-BR (~66 MB de pacote), além das dependências. Para preparar só tradução num ambiente existente, use `pnpm setup:translation`. Verifica integridade e não abre/envia áudio. A execução normal do worker usa somente arquivos locais, sem baixar no startup. O ambiente e os pesos não vão para o Git; após clone Windows/Linux, preparar novamente. Um instalador autocontido ainda não está pronto.

Durante reconhecimento, a notch mostra “Ouvindo…” e depois o texto original, com parciais e fechamento por silêncio. Pausar cancela áudio/inferência pendentes e encerra o worker; retomar inicia nova geração. Sob sobrecarga, trechos substituídos são sinalizados em vez de acumular atraso indefinido.

O [documento de decisão ASR](decisions/ASR-LOCAL.md) diferencia o baseline atual do candidato Parakeet v3, ainda sem benchmark no equipamento.

Preferências: arquivo `preferences.json` no diretório userData do Electron (normalmente `~/.config/PolyglotHelper` no Linux e `%APPDATA%/PolyglotHelper` no Windows). Não colocar esse arquivo ou credenciais no repo. Configurações inválidas são preservadas em cópia `.invalid-*` antes de oferecer novo setup.

Autostart Linux: `${XDG_CONFIG_HOME:-~/.config}/autostart/polyglot-helper.desktop`. Desmarcar e salvar remove apenas a entrada do app. Na versão de desenvolvimento, essa entrada depende do clone e runtime atuais; se mover/apagar a pasta, reconfigure ou desative o autostart. Testes usam diretórios temporários e nunca alteram seu autostart real.

Fonte salva é identificada pelo nome estável do nó PipeWire, não pelo número temporário de objeto. Após remover/trocar dispositivo, atualizar fontes e escolher o novo dispositivo; não há fallback silencioso para outro microfone.

## Windows depois do clone

Com Node instalado, no PowerShell dentro do clone:

```powershell
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm check
pnpm dev
```

Não copiar node_modules do Linux. Janelas, onboarding, preferências e integração de login Windows estão preparados, **não validados nativamente**. Captura Windows ainda não integrada: o app informa isso e oferece a demonstração. Não há instalador nesta etapa.

## Verificação

```sh
pnpm check
pnpm test:desktop
```

Checks: TypeScript, ESLint, Vitest e build. Testes desktop abrem janelas reais brevemente, com perfis temporários. Linux por padrão usa X11; em CI sem display, `xvfb-run --auto-servernum pnpm test:desktop` se disponível. Não validam sozinhos todos os aplicativos/monitores/fullscreen.

Teste nativo Wayland, após build:

```sh
HELPER_TEST_WAYLAND=1 pnpm exec playwright test
```

Verificação adicional da ordem real de janelas no X11/XWayland atual (exige xprop e window manager EWMH):

```sh
HELPER_CHECK_STACKING=1 pnpm exec playwright test
```

Ensaio opcional de 60 s de áudio sintético em saída PipeWire isolada, sem microfone/conteúdo pessoal:

```sh
HELPER_REAL_AUDIO_TEST=1 pnpm exec vitest run tests/pipewire.integration.test.ts
```

Para testar o worker com amostra pública, sem abrir microfone:

```sh
pnpm test:asr
```

Para o caminho real de captura PipeWire até ASR, em saída virtual isolada:

```sh
HELPER_ASR_TEST=1 pnpm exec vitest run tests/live-asr.integration.test.ts
```

Esses testes baixam uma pequena fixture pública JFK e validam seu hash; a inferência é local. Não confundem essa amostra com benchmark de acurácia/latência geral.

O ensaio de áudio sintético cria e remove um nó virtual de teste; não grava PCM em disco nem conecta reprodução a um alto-falante físico. O teste fica desativado no check normal/CI.

## Componentes

- `src/desktop`: janelas, IPC, preferências atômicas e autostart por SO.
- `src/core`: contratos, validação e coordenação/cancelamento de sessão/captura.
- `src/adapters/audio`: catálogo PipeWire, processo de captura e medidor PCM.
- `src/adapters/demo.ts`: frases simuladas para testar a UI.
- `src/renderer`: onboarding, configurações e notch.
- `tests`: regressões e ensaios desktop/PipeWire.

O controle local desta entrega não substitui o futuro gate autoritativo de modelos/ferramentas descrito em `research/HARNESS-CASCATAS.md`. Captura/transmissão não são decisões de confiança de um modelo.

## Tradução ao vivo

A opção Tradução salva é respeitada na captura real. O original aparece imediatamente e a tradução local entra abaixo assim que pronta; Traduzindo… indica espera. Desligar a opção cancela a tradução sem parar reconhecimento; reativar também traduz a frase atual. Pausar/parar cancela os dois processos e não reaproveita áudio da pausa.

```sh
pnpm setup:translation
pnpm test:translation
```

O setup só baixa/prepara modelo e dependências, sem enviar texto/áudio. A transcrição continua mesmo que a tradução esteja indisponível. O modelo é português brasileiro e permanece um baseline de tradução, não avaliação de todos os sotaques/domínios. Evidências em [TRADUCAO-LOCAL.md](validation/TRADUCAO-LOCAL.md).

Node 23.11.1 também foi validado neste computador com `nvm use v23`, check completo e testes desktop. O arquivo .nvmrc/CI conserva a referência LTS já definida; usar o Node 23 local não exige reinstalar o Python/modelos.

## Formatação e lint

Prettier formata TypeScript/TSX, JavaScript, CSS, HTML, JSON, YAML e Markdown. ESLint verifica o código JS/TS; eslint-config-prettier evita regras de estilo em conflito. Código Python mantém indentação de quatro espaços, mas não é formatado pelo Prettier.

```sh
pnpm format
pnpm format:check
pnpm lint
pnpm lint:fix
pnpm check
```

`check` inclui verificação de formatação antes dos checks de código, testes e build; o CI existente usa o mesmo comando. Arquivos gerados, modelos, ambiente Python e lockfiles não são reformatados. O workspace VS Code recomenda as extensões Prettier/ESLint e habilita formatação ao salvar nas linguagens suportadas.
