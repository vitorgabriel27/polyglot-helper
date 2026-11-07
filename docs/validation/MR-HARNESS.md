# MR — validação da infraestrutura do harness

Data: 07/11/2026. Ambiente: Ubuntu 26.04.1 LTS x64, Node 23.11.1, pnpm 11.25.0. Nenhuma chamada de API ou captura de áudio foi feita.

## Implementado

- Contratos tipados de agentes de captura, STT, tradução e léxico em `src/core/harness/`.
- Gate determinístico com catálogo injetado, versão de política, allowlists de fonte/destino, modo offline, geração, validação de argumentos, TTL e autorização vinculada de uso único em `src/core/policy/gate.ts`.
- Lease de streaming com expiração, escopo de sessão/fonte/destino, revogação e verificação contra política atual em `src/core/policy/stream-lease.ts`.
- Controlador de cascata que limita tentativas a três, respeita cancelamento/deadline e acumula budgets de memória/custo em `src/core/cascade/controller.ts`.
- Ring buffer de reprocessamento independente, limitado por bytes e duração; intervalos removidos retornam `expired` em `src/core/audio/reprocessing-ring-buffer.ts`.
- Fixtures sintéticas e testes offline em `tests/fixtures/harness/replay.json` e `tests/harness.test.ts`.
- Auditoria estruturada sem conteúdo de áudio/transcrição ou credenciais em `src/core/observability/audit.ts`.
- Esquema de governança futura do dataset em `docs/research/DATASET-MANIFEST.md`; ainda não há dataset próprio.

## Verificação executada

Comandos, após ativar Node 23 via nvm:

```sh
pnpm typecheck
pnpm test
```

Resultado atualizado após os primeiros ensaios MR-06/MR-14: tipagem, lint, formatação e build passaram; 8 arquivos de teste passaram e 2 ficaram ignorados; 42 testes passaram e 2 ficaram ignorados. Há 18 testes de infraestrutura MR em `tests/harness.test.ts`, `tests/constraint-shift.test.ts` e `tests/research-dataset.test.ts`.

## Limites atuais

- Verificação executada apenas no Linux; a portabilidade da suíte não substitui execução nativa Windows.
- O harness ainda não está conectado aos adaptadores/fluxo de sessão do produto.
- O validador de dataset está implementado, mas os testes usam somente registros sintéticos temporários; ainda não existe dataset próprio consentido.
- MR-14 cobre shifts determinísticos do gate e conteúdo com prompt injection; omissões/qualidade de rota aguardam um System 1 e rótulos próprios.
- Não há roteador System 1 treinado, detecção OOD calibrada, modelos ASR/tradução encadeados pelo controlador, execução de API ou benchmark do ring buffer.
- Limites de retenção do áudio precisam ser definidos por medição e política antes de uso com ASR real.
- Os resultados do artigo de pesquisa não foram reutilizados como métricas do PolyglotHelper.
