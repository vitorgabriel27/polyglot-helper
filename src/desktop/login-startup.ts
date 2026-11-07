import { app } from 'electron';
import type { LinuxAutostart } from './autostart';
export function createLoginStartup(
  linuxAutostart: LinuxAutostart,
  launchArgs: string[],
  isTest: boolean,
) {
  async function loginEnabled() {
    if (process.platform === 'linux') return linuxAutostart.enabled();
    if (process.platform === 'win32' && !isTest)
      return app.getLoginItemSettings({ path: process.execPath, args: launchArgs }).openAtLogin;
    return false;
  }
  async function setLogin(enabled: boolean) {
    if (process.platform === 'linux') await linuxAutostart.set(enabled);
    else if (process.platform === 'win32' && !isTest) {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        enabled,
        name: 'PolyglotHelper',
        path: process.execPath,
        args: launchArgs,
      });
      if ((await loginEnabled()) !== enabled)
        throw new Error('O Windows não confirmou a configuração de inicialização.');
    } else if (enabled) throw new Error('Inicialização automática indisponível neste ambiente.');
  }
  return { loginEnabled, setLogin };
}
