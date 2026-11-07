import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaults } from '../src/core/preferences';
import { SettingsStore } from '../src/desktop/settings-store';
import { desktopExec, LinuxAutostart } from '../src/desktop/autostart';

describe('first run and persistence', () => {
  it('defaults to no autostart and restores setup/source/preferences after restart', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'helper-settings-'));
    try {
      const store = new SettingsStore(dir);
      expect((await store.load()).settings).toEqual(defaults());
      const settings = {
        ...defaults(),
        onboardingComplete: true,
        sourceId: 'pipewire:stable-source',
        preferences: { translation: false, pronunciation: true, fontSize: 'large' as const },
      };
      await store.save(settings);
      expect((await new SettingsStore(dir).load()).settings).toEqual(settings);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('preserves corrupt/unsupported preferences before offering setup again', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'helper-settings-'));
    try {
      const store = new SettingsStore(dir);
      await writeFile(store.file, '{invalid');
      const result = await store.load();
      expect(result.settings.onboardingComplete).toBe(false);
      expect(result.warning).toBeTruthy();
      expect(
        (await readdir(dir)).some((file) => file.startsWith('preferences.json.invalid-')),
      ).toBe(true);
      expect(await readFile(store.file, 'utf8')).toBe('{invalid');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
describe('Linux autostart opt-in', () => {
  it('writes and removes only its own desktop entry in a temporary profile', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'helper-autostart-'));
    try {
      const autostart = new LinuxAutostart(dir, '/path with space/electron', ['/project path']);
      expect(await autostart.enabled()).toBe(false);
      await autostart.set(true);
      expect(await autostart.enabled()).toBe(true);
      expect(await readFile(autostart.file, 'utf8')).toContain(
        'Exec="/path with space/electron" "/project path"',
      );
      await autostart.set(false);
      expect(await autostart.enabled()).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('quotes arguments, escapes desktop field codes and rejects newlines', () => {
    expect(desktopExec(['/a%f', 'a"b'])).toContain('%%f');
    expect(() => desktopExec(['bad\nentry'])).toThrow();
  });
});
