# M2 — fundações compartilhadas

Status: fundação de código compartilhado concluída; validação nativa Windows e armazenamento de credenciais permanecem pendentes conforme as dependências abaixo.

## Organização e contratos

- `src/desktop`: ciclo de vida Electron, preload restrito, segurança de janela, persistência, autostart e composição.
- `src/renderer`: interface React, estado visual e bridge; sem acesso a Node, captura ou segredos.
- `src/core`: preferências, contratos, sessão, coordenação de áudio, fala e tradução.
- `src/adapters`: implementações específicas de captura, ASR e tradução.
- `workers`: inferência local fora do processo de interface.

`core/contracts.ts` exporta `AudioChunk` (PCM com taxa, canais e timestamps), `TranscriptSegment` (sessão/geração, ID/sequência, revisão e intervalo), aliases canônicos `SpeechProvider`/`TranslationProvider`, eventos desktop tipados e comandos validados. Implementações locais adotam os contratos. `Session` testa inicialização, escuta, reconexão, pausa, falha e encerramento; gerações antigas não podem alterar a sessão atual. O estado das configurações pertence à janela/UI e continua independente da captura.

## Segurança e persistência

O preload expõe somente snapshot, comandos validados e assinatura do evento de estado. Sandbox, context isolation e CSP continuam ativos. Preferências usam versão de esquema, gravação temporária + rename e preservação de JSON inválido. A aplicação ainda não usa credenciais. Ao selecionar provedor remoto, adicionar armazenamento nativo por SO com falha fechada; não introduzir arquivo em texto puro.

## Automação e verificação

`.github/workflows/check.yml` executa `pnpm check` em `ubuntu-latest` e `windows-latest`; os testes desktop são executados em ambos, com Xvfb no Linux. Nesta máquina Linux, `pnpm check` passou após a consolidação: Prettier, TypeScript, ESLint, Vitest e build. A suíte de ciclo de sessão foi ampliada para verificar explicitamente `reconnecting` e `stopping`.

Essa evidência demonstra configuração da CI e execução local Linux; não afirma resultado de um job Windows nesta revisão. A conclusão de M2 como piloto multiplataforma ainda depende dos critérios M1 e da execução real no Windows.
