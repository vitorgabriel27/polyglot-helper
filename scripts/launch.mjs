import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);

if (process.platform === 'linux') {
  const electronDirectory = dirname(require.resolve('electron/package.json'));
  const sandboxPath = join(electronDirectory, 'dist', 'chrome-sandbox');
  if (existsSync(sandboxPath)) {
    const sandbox = statSync(sandboxPath);
    if (sandbox.uid !== 0 || (sandbox.mode & 0o7777) !== 0o4755) {
      console.error(
        `O helper de sandbox do Electron está mal configurado: ${sandboxPath}\n` +
          `Execute: sudo chown root:root '${sandboxPath}' && sudo chmod 4755 '${sandboxPath}'\n` +
          'Depois, reinstale as dependências com pnpm install para aplicar a correção automaticamente.',
      );
      process.exit(1);
    }
  }
}

const requested = process.argv.slice(2);
const flags = [];
if (process.platform === 'linux') {
  const wayland = requested.includes('--wayland') || requested.includes('--ozone-platform=wayland');
  const x11 = requested.includes('--x11') || requested.includes('--ozone-platform=x11');
  flags.push(`--ozone-platform=${!x11 && (wayland || !process.env.DISPLAY) ? 'wayland' : 'x11'}`);
  if (!requested.includes('--enable-gpu')) flags.push('--disable-gpu');
}
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(
  process.execPath,
  [require.resolve('electron/cli.js'), '.', ...flags, ...requested],
  {
    stdio: 'inherit',
    env: environment,
  },
);
child.on('error', (cause) => {
  console.error(cause.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
