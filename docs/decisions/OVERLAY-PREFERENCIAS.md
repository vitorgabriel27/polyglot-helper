# Primeira configuração, preferências e sobreposição

Data: 07/11/2026. Pedido do usuário: selecionar uma única vez na primeira abertura, guardar preferências, oferecer iniciar com o sistema e manter a notch acima do aplicativo usado.

## Comportamento implementado

- Primeira abertura mostra configuração inicial; depois de Salvar e continuar, o app restaura as escolhas sem repetir esse painel automaticamente.
- Salvar mantém fonte de áudio por identidade estável, tradução, IPA, tamanho e preferência de inicialização. Fechar sem salvar descarta alterações do formulário.
- O usuário pode reabrir configurações a qualquer momento clicando na notch.
- Fonte indisponível não provoca mudança automática para outro microfone/saída. O app informa indisponibilidade e pede seleção/atualização.
- Iniciar com o sistema é opt-in, desmarcado por padrão. Abrir ao login não inicia captura. Sempre é necessário clicar Iniciar ou usar o atalho.
- Autostart Linux usa entrada Desktop Entry no diretório de configuração do usuário; Windows usa API de login do Electron. Não exige alterar serviços de sistema nem inicialização de outros usuários.
- Preferências usam JSON versionado em userData, esquema validado e escrita atômica. Arquivo inválido é copiado para recuperação e exige configurar novamente.

## Sobreposição e foco

A notch é always-on-top, nível screen-saver; é mantida nas áreas de trabalho onde a API permite, e o nível é reaplicado se removido. Ao perder foco, é elevada na ordem de janelas sem chamar focus. Configurações só tomam foco por abertura explícita; o painel inicial permanece disponível mesmo se perder foco durante o startup.

Para cumprir posição e ordem de janelas no GNOME atual, o backend padrão Linux passa a ser **X11/XWayland quando DISPLAY existe**, sem exigir trocar toda a sessão Wayland. O modo Wayland nativo é experimental e pode ser solicitado com `--wayland`. Se DISPLAY não existir, o app mantém Wayland nativo e informa a limitação. Não simular garantias globais que o compositor não fornece.

Windows é preparado com as mesmas APIs de janela, ainda aguardando validação nativa. Tela de bloqueio/desktop seguro e tela cheia exclusiva podem impedir a sobreposição; não se promete contornar controles do sistema. Validação manual ainda precisa cobrir aplicativos diferentes, tela cheia, monitores e escalas.

## Captura desta entrega

Linux/PipeWire lista microfones e saídas. Captura selecionada é local, PCM s16le mono 16 kHz, com medidor RMS/duração; não há gravação persistente, STT, envio à nuvem ou treinamento. Ao pausar/parar, o processo de captura é encerrado e callbacks antigos são invalidados.

O teste de integração nativo usa uma saída virtual isolada e tom sintético; não captura conteúdo pessoal. Dispositivos físicos/troca para fones permanecem na validação manual. Captura Windows permanece explicitamente indisponível até integração própria; demonstração e configurações continuam executáveis.

## Referências

- [Electron — login items](https://www.electronjs.org/docs/latest/api/app)
- [Electron — janela/sobreposição](https://www.electronjs.org/docs/latest/api/browser-window)
- [PipeWire — pw-cat/pw-record](https://docs.pipewire.org/page_man_pw-cat_1.html)
- [PipeWire — propriedades de streams](https://docs.pipewire.org/page_man_pipewire-props_7.html)
