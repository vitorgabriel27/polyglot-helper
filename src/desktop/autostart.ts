import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Desktop Entry Exec quoting: quote every argument, escape reserved characters and field codes.
export function desktopExec(args: string[]) {
  if (args.some((arg) => /[\r\n\0]/.test(arg)))
    throw new Error('Caminho inválido para inicialização.');
  return args
    .map((arg) => {
      const quoted = `"${arg.replace(/%/g, '%%').replace(/[\\"`$]/g, '\\$&')}"`;
      return quoted.replace(/\\/g, '\\\\');
    })
    .join(' ');
}
export class LinuxAutostart {
  readonly file: string;
  constructor(
    configDirectory: string,
    private executable: string,
    private args: string[],
  ) {
    this.file = path.join(configDirectory, 'autostart', 'polyglot-helper.desktop');
  }
  async set(enabled: boolean) {
    if (!enabled) {
      await rm(this.file, { force: true });
      return;
    }
    await mkdir(path.dirname(this.file), { recursive: true });
    const content = `[Desktop Entry]\nType=Application\nName=PolyglotHelper\nComment=Assistente de idiomas\nExec=${desktopExec([this.executable, ...this.args])}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`;
    await writeFile(`${this.file}.tmp`, content, { encoding: 'utf8', mode: 0o600 });
    await rename(`${this.file}.tmp`, this.file);
  }
  async enabled() {
    try {
      return (await readFile(this.file, 'utf8')).includes('X-GNOME-Autostart-enabled=true');
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw cause;
    }
  }
}
