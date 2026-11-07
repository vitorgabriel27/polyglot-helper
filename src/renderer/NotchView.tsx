import type { Command, Snapshot } from '../core/contracts';
import { useState } from 'react';
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
  const [expanded, setExpanded] = useState(false);
  const current = snapshot.segment;
  const history = current
    ? snapshot.recentSegments.filter((item) => item.segmentId !== current.segmentId)
    : snapshot.recentSegments;
  const previous = history.at(-1);
  const transportLabel = busy
    ? isAudio
      ? 'Pausar captura'
      : 'Pausar demonstração'
    : isAudio
      ? 'Iniciar captura'
      : 'Iniciar demonstração';
  return (
    <section
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
      }}
      className={`notch ${busy || snapshot.state === 'error' ? 'active' : ''} ${expanded ? 'expanded' : ''} ${snapshot.preferences.fontSize}`}
      aria-label="PolyglotHelper"
    >
      <div className="notch-bar">
        <span
          className="source-icon grip"
          aria-label="Segure para mover a notch"
          title="Segure para mover"
        >
          {isAudio ? '♫' : '◉'}
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
            {expanded && previous && <p className="context-line previous-line">{previous.text}</p>}
            <p className="original current-line">
              {snapshot.segment?.text ||
                (snapshot.state === 'starting' ? 'Preparando reconhecimento local…' : 'Ouvindo…')}
            </p>
            {expanded && <p className="context-line next-line">Próximo trecho aparecerá aqui</p>}
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
            {expanded && previous && <p className="context-line previous-line">{previous.text}</p>}
            <p className="original">{snapshot.segment?.text || 'Preparando demonstração…'}</p>
            {expanded && <p className="context-line next-line">Próximo trecho aparecerá aqui</p>}
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
