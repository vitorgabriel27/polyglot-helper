# M0 — evidências de ambiente

Coleta somente de leitura em 07/11/2026. Nenhuma captura de áudio ou tela foi iniciada. Não foram inspecionadas partições do dual boot.

## Linux observado

| Item                                          | Evidência                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Distribuição                                  | /etc/os-release: Ubuntu 26.04.1 LTS, VERSION_ID=26.04                                             |
| CPU/arquitetura do SO                         | uname -m: x86_64                                                                                  |
| Desktop                                       | XDG_CURRENT_DESKTOP=ubuntu:GNOME; gnome-shell --version: GNOME Shell 50.1                         |
| Sessão                                        | XDG_SESSION_TYPE=wayland; WAYLAND_DISPLAY=wayland-0; DISPLAY=:0                                   |
| Áudio instalado                               | pw-cli: compilado/vinculado com libpipewire 1.6.2                                                 |
| Serviços                                      | systemctl --user is-active: pipewire.service=active; wireplumber.service=active                   |
| Sessões instaladas nos diretórios consultados | /usr/share/wayland-sessions/ubuntu.desktop; /usr/share/xsessions não existe                       |
| Node                                          | v22.12.0; compatibilidade com ferramentas futuras ainda precisa ser verificada                    |
| pnpm                                          | 11.25.0                                                                                           |
| Windows nesta sessão                          | powershell.exe e wine não encontrados no PATH; isso não comprova ausência do Windows em dual boot |

DISPLAY presente numa sessão Wayland não comprova sessão X11 nativa. Serviços ativos não comprovam que a captura foi autorizada ou funciona. Lista de sessões não exclui outras formas de iniciar X11.

## Windows informado pelo usuário

O usuário confirmou Windows no mesmo computador, em dual boot. Versão, build, arquitetura e disponibilidade de ferramentas não foram verificadas.

No PowerShell do Windows, os seguintes comandos são somente de identificação e não capturam conteúdo:

```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture
$env:PROCESSOR_ARCHITECTURE
node --version
pnpm --version
```

Se Node/pnpm não estiverem instalados, registrar como ausentes; não é falha da identificação. Não compartilhar números de série, chaves, nome de usuário ou saída integral de inventários do sistema.

## Evidências ainda necessárias

- Acesso nativo ao Windows do dual boot e identificação exata.
- Prova de janela, foco e captura de áudio em cada SO: pertence ao M1.
- Hardware para benchmark local: coletar na etapa de comparação quando o teste local for iniciado.
