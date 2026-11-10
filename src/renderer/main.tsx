import { api } from './desktop-api';
import { useSnapshot } from './snapshot-store';
import { SettingsView } from './SettingsView';
import { NotchView } from './NotchView';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Command, UserSettings } from '../core/contracts';
import './style.css';

function App() {
  const { snapshot, update } = useSnapshot();
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const isSettings = new URLSearchParams(window.location.search).get('view') === 'settings';
  const command = (value: Command) =>
    api
      .command(value)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
            : 'Não foi possível executar esta ação.',
        ),
      );
  const settingsKey = snapshot ? JSON.stringify(snapshot.settings) : '';
  useEffect(() => {
    if (settingsKey) setDraft(JSON.parse(settingsKey) as UserSettings);
  }, [settingsKey, snapshot?.settingsRevision]);
  useEffect(() => {
    let receivedUpdate = false;
    const unsubscribe = api.subscribe((state) => {
      receivedUpdate = true;
      update(state);
    });
    api
      .snapshot()
      .then((state) => {
        if (!receivedUpdate) update(state);
      })
      .catch(() => setError('Falha ao conectar ao aplicativo.'));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSettings) void api.command({ type: 'close-settings' });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKey);
    };
  }, [isSettings, update]);
  const loaded = snapshot !== null && draft !== null;
  useEffect(() => {
    if (isSettings || !loaded) return;
    const surface = document.querySelector('.notch');
    if (!surface) return;
    const observer = new ResizeObserver(() => {
      const height = Math.max(
        50,
        Math.min(
          window.screen.availHeight - 8,
          Math.ceil(surface.getBoundingClientRect().height + 6),
        ),
      );
      void api
        .command({ type: 'fit-notch', height })
        .catch(() => setError('Falha ao ajustar a janela.'));
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, [isSettings, loaded]);
  if (!snapshot || !draft)
    return (
      <div className="loading" role="status">
        {error || 'PolyglotHelper…'}
      </div>
    );
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.command({ type: 'configure', value: { ...draft, onboardingComplete: true } });
      setError('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : 'Não foi possível salvar.',
      );
    } finally {
      setSaving(false);
    }
  };
  if (isSettings)
    return <SettingsView {...{ snapshot, draft, setDraft, saving, save, command, error }} />;
  return <NotchView {...{ snapshot, command, error }} />;
}
createRoot(document.getElementById('root')!).render(<App />);
