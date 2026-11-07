import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = path.join(root, '.asr-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: false });
    child.on('error', () => reject(new Error(`Não foi possível executar ${command}. Instale uv e tente novamente.`)));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Preparação falhou (${code}).`)));
  });
}
try {
  await run('uv', ['venv', '--python', '3.11', '--allow-existing', '.asr-venv']);
  await run('uv', ['pip', 'sync', '--python', python, 'workers/asr/requirements.lock']);
  await run(python, ['workers/asr/prepare.py']);
} catch (cause) { console.error(cause.message); process.exitCode = 1; }
