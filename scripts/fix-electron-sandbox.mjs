import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

if (process.platform !== 'linux') process.exit(0);

const require = createRequire(import.meta.url);
const electronDirectory = dirname(require.resolve('electron/package.json'));
const sandboxPath = join(electronDirectory, 'dist', 'chrome-sandbox');

if (!existsSync(sandboxPath)) {
  console.error(`Electron sandbox helper não encontrado: ${sandboxPath}`);
  process.exit(1);
}

const current = statSync(sandboxPath);
if (current.uid === 0 && (current.mode & 0o7777) === 0o4755) process.exit(0);

console.log('Configurando o helper de sandbox do Electron (root:root, modo 4755)...');
const result = spawnSync('sudo', ['chown', 'root:root', sandboxPath], { stdio: 'inherit' });
if (result.error || result.status !== 0) {
  console.error(
    `Não foi possível configurar ${sandboxPath}. Execute manualmente:\n` +
      `  sudo chown root:root '${sandboxPath}'\n` +
      `  sudo chmod 4755 '${sandboxPath}'`,
  );
  process.exit(1);
}

const chmod = spawnSync('sudo', ['chmod', '4755', sandboxPath], { stdio: 'inherit' });
if (chmod.error || chmod.status !== 0) {
  console.error(
    `Não foi possível definir o modo do helper. Execute: sudo chmod 4755 '${sandboxPath}'`,
  );
  process.exit(1);
}

const fixed = statSync(sandboxPath);
if (fixed.uid !== 0 || (fixed.mode & 0o7777) !== 0o4755) {
  console.error(`O helper continua sem a configuração necessária: ${sandboxPath}`);
  process.exit(1);
}

console.log('Helper do sandbox configurado.');
