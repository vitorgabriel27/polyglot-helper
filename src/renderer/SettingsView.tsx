import type { Command, Snapshot, UserSettings } from '../core/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
export function SettingsView({
  snapshot,
  draft,
  setDraft,
  saving,
  save,
  command,
  error,
}: {
  snapshot: Snapshot;
  draft: UserSettings;
  setDraft: (value: UserSettings) => void;
  saving: boolean;
  save: () => Promise<void>;
  command: (value: Command) => Promise<unknown>;
  error: string;
}) {
  const scrollRef = useRef<HTMLElement>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0 });
  const updateThumb = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const visible = element.clientHeight;
    const total = element.scrollHeight;
    const height = total > visible ? Math.max(28, (visible / total) * visible) : 0;
    const top = total > visible ? (element.scrollTop / (total - visible)) * (visible - height) : 0;
    setThumb({ top, height });
  }, []);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(updateThumb);
    observer.observe(element);
    observer.observe(element.firstElementChild ?? element);
    updateThumb();
    return () => observer.disconnect();
  }, [updateThumb]);
  const busy = ['listening', 'starting'].includes(snapshot.state);
  const isAudio = snapshot.mode === 'local-audio';
  const missingSource =
    draft.sourceId !== null &&
    !snapshot.audioSources.some((source) => source.id === draft.sourceId);
  return (
    <div className="settings-shell">
      <section
        ref={scrollRef}
        onScroll={updateThumb}
        className="settings"
        aria-label="Configurações rápidas"
      >
        <header>
          <div>
            <span className="eyebrow">POLYGLOTHELPER</span>
            <h1>{snapshot.settings.onboardingComplete ? 'Do seu jeito.' : 'Vamos começar.'}</h1>
          </div>
          <button
            aria-label="Fechar configurações"
            onClick={() => void command({ type: 'close-settings' })}
          >
            ×
          </button>
        </header>
        <p className="notice">
          {snapshot.settings.onboardingComplete
            ? 'Preferências salvas neste computador.'
            : 'Escolha uma vez. Você pode mudar depois.'}
        </p>
        <div className="field">
          <span>Idioma</span>
          <strong>Inglês → Português</strong>
        </div>
        <label className="source-field">
          <span>Fonte de áudio</span>
          <select
            value={draft.sourceId ?? ''}
            onChange={(event) => setDraft({ ...draft, sourceId: event.target.value || null })}
          >
            <option value="">Demonstração (sem captura)</option>
            {missingSource && (
              <option value={draft.sourceId!} disabled>
                Fonte salva indisponível
              </option>
            )}
            {snapshot.audioSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.kind === 'system' ? 'Sistema' : 'Microfone'} — {source.label}
              </option>
            ))}
          </select>
        </label>
        <div className="source-refresh">
          <button
            type="button"
            disabled={snapshot.sourcesLoading}
            onClick={() => void command({ type: 'refresh-sources' })}
          >
            {snapshot.sourcesLoading ? 'Procurando…' : 'Atualizar fontes'}
          </button>
        </div>
        {snapshot.sourceError && <p className="hint">{snapshot.sourceError}</p>}
        {missingSource && !snapshot.sourcesLoading && (
          <p className="hint">
            Conecte a fonte salva ou escolha outra. Não trocaremos para outro dispositivo
            automaticamente.
          </p>
        )}
        <label className="field">
          <span>Tradução</span>
          <input
            type="checkbox"
            checked={draft.preferences.translation}
            onChange={(event) =>
              setDraft({
                ...draft,
                preferences: { ...draft.preferences, translation: event.target.checked },
              })
            }
          />
        </label>
        <label className="field">
          <span>Pronúncia em IPA</span>
          <input
            type="checkbox"
            checked={draft.preferences.pronunciation}
            onChange={(event) =>
              setDraft({
                ...draft,
                preferences: { ...draft.preferences, pronunciation: event.target.checked },
              })
            }
          />
        </label>
        <label className="field">
          <span>Tamanho da legenda</span>
          <select
            value={draft.preferences.fontSize}
            onChange={(event) =>
              setDraft({
                ...draft,
                preferences: {
                  ...draft.preferences,
                  fontSize: event.target.value === 'large' ? 'large' : 'normal',
                },
              })
            }
          >
            <option value="normal">Normal</option>
            <option value="large">Grande</option>
          </select>
        </label>
        <label className="field">
          <span>Iniciar com o sistema</span>
          <input
            type="checkbox"
            checked={draft.launchAtLogin}
            onChange={(event) => setDraft({ ...draft, launchAtLogin: event.target.checked })}
          />
        </label>
        <p className="hint">
          Abre o assistente ao entrar na sessão. A captura só começa quando você clicar em Iniciar.
        </p>
        <div className="actions">
          <button className="primary" disabled={saving} onClick={() => void save()}>
            {saving
              ? 'Salvando…'
              : snapshot.settings.onboardingComplete
                ? 'Salvar'
                : 'Salvar e continuar'}
          </button>
          {snapshot.settings.onboardingComplete && (
            <>
              <button onClick={() => void command({ type: 'toggle-session' })}>
                {busy ? 'Pausar' : isAudio ? 'Iniciar captura' : 'Iniciar demonstração'}
              </button>
              <button onClick={() => void command({ type: 'stop' })}>Parar</button>
            </>
          )}
          <button onClick={() => void command({ type: 'quit' })}>Sair</button>
        </div>
        <p className="hint">
          {draft.sourceId
            ? 'Reconhecimento de inglês no próprio computador. Nenhum áudio é gravado em arquivo ou enviado à nuvem. Tradução local para português disponível; IPA para áudio ainda em preparação.'
            : 'Demonstração com frases de exemplo. Modelos e APIs ainda não conectados.'}
        </p>
        {draft.sourceId && !snapshot.speech.available && (
          <p className="hint">
            O reconhecimento local ainda não foi preparado neste computador. Consulte o guia de
            instalação.
          </p>
        )}
        {draft.sourceId && draft.preferences.translation && !snapshot.translation.available && (
          <p className="hint">O modelo de tradução ainda não foi preparado neste computador.</p>
        )}
        {snapshot.shortcutAvailable && (
          <p className="hint">Ctrl + Shift + Espaço · pausar ou retomar</p>
        )}
        {snapshot.wayland && (
          <p className="hint">
            Wayland nativo: o desktop pode limitar a sobreposição. O modo padrão usa XWayland quando
            disponível.
          </p>
        )}
        {(error || snapshot.error) && <p role="alert">{error || snapshot.error}</p>}
      </section>
      <div
        className="settings-scroll-thumb"
        aria-hidden="true"
        style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
      />
    </div>
  );
}
