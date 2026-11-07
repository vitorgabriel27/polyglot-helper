import type { Command, Snapshot } from '../core/contracts';
export function NotchView({
  snapshot,
  command,
  error,
}: {
  snapshot: Snapshot;
  command: (value: Command) => Promise<unknown>;
  error: string;
}) {
  const active = snapshot.state === 'listening';
  const busy = active || snapshot.state === 'starting';
  const isAudio = snapshot.mode === 'local-audio';
  const transportLabel = busy
    ? isAudio
      ? 'Pausar captura'
      : 'Pausar demonstração'
    : isAudio
      ? 'Iniciar captura'
      : 'Iniciar demonstração';
  return (
    <section
      className={`notch ${busy || snapshot.state === 'error' ? 'active' : ''} ${snapshot.preferences.fontSize}`}
      aria-label="PolyglotHelper"
    >
      <div className="notch-bar">
        <span className="grip" aria-hidden="true">
          ⠿
        </span>
        <button
          className="identity"
          aria-label="Abrir configurações"
          onClick={() => void command({ type: 'open-settings' })}
        >
          <span className={`dot ${active ? 'live' : ''}`} />
          <span>PolyglotHelper</span>
        </button>
        <span className="badge">
          {isAudio
            ? snapshot.state === 'starting'
              ? 'ABRINDO'
              : active
                ? 'LOCAL'
                : 'ÁUDIO'
            : 'DEMO'}
        </span>
        <button
          className="transport"
          aria-label={transportLabel}
          onClick={() => void command({ type: 'toggle-session' })}
        >
          {busy ? 'Ⅱ' : '▶'}
        </button>
      </div>
      {busy &&
        (isAudio ? (
          <div className="captions live-captions" aria-live="polite" aria-atomic="true">
            <p className="original">
              {snapshot.segment?.text ||
                (snapshot.state === 'starting' ? 'Preparando reconhecimento local…' : 'Ouvindo…')}
            </p>
            {snapshot.preferences.translation && snapshot.segment?.text && (
              <p
                className={`translation ${snapshot.segment.translation ? '' : 'translation-pending'}`}
              >
                {snapshot.segment.translation ||
                  (snapshot.translation.state === 'error'
                    ? 'Tradução indisponível — a transcrição continua.'
                    : 'Traduzindo…')}
              </p>
            )}
            <div className="live-status">
              <meter aria-label="Nível do áudio" min={0} max={1} value={snapshot.metrics.rms} />
              <span>
                {snapshot.speech.state === 'transcribing' ? 'Reconhecendo' : 'Inglês · local'}
              </span>
            </div>
            {snapshot.speech.dropped > 0 && (
              <p className="hint">
                O áudio está mais rápido que o reconhecimento. Alguns trechos foram ignorados para
                acompanhar o conteúdo atual.
              </p>
            )}
          </div>
        ) : (
          <div className="captions" aria-live="polite" aria-atomic="true">
            <p className="original">{snapshot.segment?.text || 'Preparando demonstração…'}</p>
            {snapshot.preferences.translation && (
              <p className="translation">{snapshot.segment?.translation || '…'}</p>
            )}
            {snapshot.preferences.pronunciation && (
              <p className="pronunciation">{snapshot.segment?.pronunciation || '…'}</p>
            )}
          </div>
        ))}
      {(error || snapshot.error) && (
        <p className="notch-error" role="alert">
          {error || snapshot.error}
        </p>
      )}
    </section>
  );
}
