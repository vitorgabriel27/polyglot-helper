# Plano e execução da modularização

Refatoração por responsabilidade, preservando comandos IPC, markup, cancelamento e geração de sessão.

1. Separar apresentação da notch e configurações em componentes com props tipadas.
2. Isolar acesso ao preload e armazenamento do snapshot no renderer.
3. Extrair posicionamento, proteção de janelas e autostart do coordenador desktop.
4. Validar formatação, tipagem, lint, testes unitários, build e regressões desktop.

## Organização resultante

- `renderer/main.tsx`: montagem, sincronização com desktop, rascunho e ações.
- `renderer/NotchView.tsx`: apresentação da notch e legendas.
- `renderer/SettingsView.tsx`: formulário de configuração.
- `renderer/desktop-api.ts`: referência ao bridge tipado do preload.
- `renderer/snapshot-store.ts`: armazenamento Zustand do snapshot.
- `desktop/window-position.ts`: limites e posicionamento das duas janelas.
- `desktop/window-security.ts`: bloqueio de navegação, webviews e novas janelas.
- `desktop/login-startup.ts`: consulta e alteração de inicialização por SO.
- `desktop/main.ts`: composição e coordenação do ciclo de vida, IPC e sessão.

Os módulos de core e adaptadores existentes continuam definindo as fronteiras de áudio, ASR e tradução. A extração da coordenação de sessão em um serviço próprio fica para uma refatoração posterior, com contratos explícitos de estado e encerramento; não foi movida mecanicamente para outro arquivo.
