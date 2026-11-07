# MR-14 — ensaios determinísticos de mudança de restrição

Data: 07/11/2026. Ambiente: Linux, Node 23.11.1. Nenhuma captura ou API foi usada.

## Implementado nesta fatia

`tests/constraint-shift.test.ts` usa a mesma transcrição e proposta para verificar:

- fonte removida da allowlist;
- preferência offline estrita habilitada;
- orçamento máximo reduzido abaixo do custo proposto;
- geração da sessão alterada;
- versão do catálogo alterada;
- sessão encerrada entre decisão e execução;
- instrução maliciosa dentro da transcrição, que continua sendo dado e não altera a política/destino autorizados.

Verificação executada: `pnpm exec vitest run tests/constraint-shift.test.ts` (4 testes passaram) e `pnpm typecheck`.

## Limites

- São testes do gate, não avaliação de qualidade de rota.
- O System 1 não está treinado/integrado; ainda não é possível medir omissões de intenção, cobertura ou risco seletivo do roteador.
- Não foram incluídos áudio, rede, prompts enviados a serviços ou dados de usuário.
