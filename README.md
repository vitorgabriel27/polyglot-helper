# PolyglotHelper — assistente de imersão

Protótipo de experiência e plano de um aplicativo desktop que acompanha textos, vídeos e áudio com original, tradução e pronúncia.

## Aplicativo desktop — primeira base executável

Pasta oficial: `/home/vitor-g/polyglot-project` · branch `main`.

Com Node 22.22+ e pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Notch com configuração inicial única, preferências persistentes e início com o sistema opcional. Linux já oferece captura local e transcrição real em inglês e tradução para português brasileiro, com modelos preparados por `pnpm setup:local`. IPA para áudio, harness e APIs ainda não conectados. Windows preparado para validação posterior. Veja [execução no Linux/Windows e verificações](docs/DESENVOLVIMENTO.md).

## Explorar

Abra `prototype/index.html` no navegador. Sem instalação, conta ou chave de API.

O protótipo permite alternar fonte de conteúdo, inglês/espanhol, pronúncia aproximada/IPA, esconder tradução, pausar a demonstração e salvar palavras durante a sessão. Clique nas palavras da frase.

**Demonstração com frases previamente escritas:** não captura a tela, não escuta áudio, não traduz conteúdo novo e não cria uma sobreposição fora do navegador. A próxima frase é avançada manualmente; pausar bloqueia esse avanço. O vocabulário é mantido só enquanto a página está aberta.

Comece pelo [roadmap de metas e tarefas para Windows e Linux](docs/ROADMAP.md), com dependências, estimativas e critérios de conclusão.

Leia a [arquitetura e stack da notch mínima](docs/ARQUITETURA.md), direção atual do projeto. O [plano inicial](docs/PLANO.md) e o protótipo acima registram a exploração anterior.

## Estado atual

M0 parcialmente pendente; implementação técnica iniciada por autorização do usuário, com validação Windows adiada para o clone nativo. Estado inicial do ambiente: [decisões e matriz de suporte](docs/decisions/M0-ESCOPO.md) e [evidências de ambiente](docs/validation/M0-AMBIENTE.md). Ubuntu/GNOME/Wayland identificado; Windows em dual boot informado pelo usuário. Harness local com cascatas e escalada seletiva é a direção atual; configuração e permissão operacional de nuvem dependem da comparação.

## Pesquisa aplicada

A arquitetura incorpora [harness de agentes, cascatas e System 1 local](docs/research/HARNESS-CASCATAS.md), adaptados do artigo fornecido pelo usuário. O roteador seleciona modelos; um gate independente autoriza efeitos. Escalada até API depende de política atual e orçamento. Implementação e validação ainda pendentes.
