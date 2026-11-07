import { mkdir, readFile, rename, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { defaults, isUserSettings, type UserSettings } from '../core/preferences';

export class SettingsStore {
  readonly file: string;
  constructor(directory: string) {
    this.file = path.join(directory, 'preferences.json');
  }
  async load(): Promise<{ settings: UserSettings; warning: string | null }> {
    let content: string;
    try {
      content = await readFile(this.file, 'utf8');
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT')
        return { settings: defaults(), warning: null };
      throw new Error(
        'Não foi possível ler as preferências. Verifique as permissões da pasta do aplicativo.',
        { cause },
      );
    }
    try {
      const value: unknown = JSON.parse(content);
      if (!isUserSettings(value)) throw new Error('schema');
      return { settings: value, warning: null };
    } catch {
      // Preserve the original for recovery; never silently destroy an unsupported schema.
      await copyFile(this.file, `${this.file}.invalid-${Date.now()}`);
      return {
        settings: defaults(),
        warning:
          'As preferências estavam inválidas. Uma cópia foi preservada e a configuração inicial será refeita.',
      };
    }
  }
  async save(settings: UserSettings) {
    if (!isUserSettings(settings)) throw new Error('Preferências inválidas.');
    await mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    await writeFile(temp, `${JSON.stringify(settings, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temp, this.file);
  }
}
