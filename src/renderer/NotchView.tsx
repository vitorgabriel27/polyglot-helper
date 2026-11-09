import type { Command, Snapshot } from '../core/contracts';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [hoveredWord, setHoveredWord] = useState('');
  const [wordMeaning, setWordMeaning] = useState<{ key: string; text: string } | null>(null);
  const activeLookup = useRef('');
  const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0, width: 280 });
  const current = snapshot.segment;
  const history = current
    ? snapshot.recentSegments.filter((item) => item.segmentId !== current.segmentId)
    : snapshot.recentSegments;
  const timeline = [...history, ...(current ? [current] : [])];
  const selectedIndex = historyIndex === null ? timeline.length - 1 : historyIndex;
  const selected = timeline[selectedIndex] ?? current;
  const navigate = (delta: number) => {
    setHistoryIndex((index) => {
      const next = (index === null ? timeline.length - 1 : index) + delta;
      return Math.max(0, Math.min(timeline.length - 1, next));
    });
  };
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
  };
  const renderWord = (word: string, index: number) => (
    <span
      className="word"
      key={`${index}-${word}`}
      onMouseEnter={(event) => {
        positionPopover(event.currentTarget);
        showWord(word, selected?.segmentId ?? '');
      }}
      onMouseLeave={() => {
        activeLookup.current = '';
        setHoveredWord('');
      }}
      tabIndex={0}
      onFocus={(event) => {
        positionPopover(event.currentTarget);
        showWord(word, selected?.segmentId ?? '');
      }}
      onBlur={() => {
        activeLookup.current = '';
        setHoveredWord('');
      }}
    >
      {word}{' '}
    </span>
  );
  function showWord(rawWord: string, segmentId: string) {
    const word = rawWord.replace(/[^\p{L}'-]/gu, '');
    if (!word) return;
    const key = `${segmentId}::${word}`;
    activeLookup.current = key;
    setHoveredWord(key);
    setWordMeaning({ key, text: 'Buscando…' });
    void command({ type: 'lookup-word', word }).then((answer) => {
      if (activeLookup.current !== key) return;
      setWordMeaning({
        key,
        text: typeof answer === 'string' ? answer : 'significado indisponível',
      });
    });
  }
  function positionPopover(word: HTMLElement) {
    const bounds = word.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const popoverHeight = 164;
    const section = word.closest('.notch') as HTMLElement | null;
    const sectionBounds = section?.getBoundingClientRect();
    const contentHeight = Math.ceil(section?.scrollHeight ?? 62) + 6;
    const useAbove = Boolean(
      sectionBounds && bounds.top - sectionBounds.top > sectionBounds.height / 2,
    );
    const placement = useAbove ? 'above' : 'below';
    const extraHeight = popoverHeight + 12;
    const fitHeight = Math.min(window.screen.availHeight - 8, contentHeight + extraHeight);
    void command({
      type: 'fit-notch-popover',
      height: fitHeight,
      baseHeight: Math.min(contentHeight, fitHeight),
      placement,
    });
    const suggestedTop = useAbove ? bounds.top - popoverHeight - 8 : bounds.bottom + 8;
    setPopoverPosition({
      left: Math.max(
        12,
        Math.min(bounds.left + bounds.width / 2 - width / 2, window.innerWidth - width - 12),
      ),
      top: Math.max(8, suggestedTop),
      width,
    });
  }
  const hoveredSegment = hoveredWord
    ? (timeline.find((item) => item.segmentId === hoveredWord.split('::')[0]) ?? selected)
    : null;
  const wordInfo = hoveredWord && hoveredSegment;
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
            {expanded && timeline.length > 0 && (
              <div className="history-nav" aria-label="Navegação do histórico">
                <button
                  aria-label="Trecho anterior"
                  onClick={() => navigate(-1)}
                  disabled={selectedIndex <= 0}
                >
                  ‹
                </button>
                <span>
                  {selected ? formatTime(selected.startMs) : '0:00'} · {selectedIndex + 1}/
                  {timeline.length}
                </span>
                <button
                  aria-label="Próximo trecho"
                  onClick={() => navigate(1)}
                  disabled={selectedIndex >= timeline.length - 1}
                >
                  ›
                </button>
              </div>
            )}
            <p className="original current-line">
              {selected?.text
                ? selected.text.split(/(\s+)/).map(renderWord)
                : snapshot.segment?.text ||
                  (snapshot.state === 'starting' ? 'Preparando reconhecimento local…' : 'Ouvindo…')}
            </p>
            {snapshot.preferences.translation && selected?.text && (
              <p className={`translation ${selected.translation ? '' : 'translation-pending'}`}>
                {selected.translation ||
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
            {expanded && timeline.length > 0 && (
              <div className="history-nav" aria-label="Navegação do histórico">
                <button
                  aria-label="Trecho anterior"
                  onClick={() => navigate(-1)}
                  disabled={selectedIndex <= 0}
                >
                  ‹
                </button>
                <span>
                  {selected ? formatTime(selected.startMs) : '0:00'} · {selectedIndex + 1}/
                  {timeline.length}
                </span>
                <button
                  aria-label="Próximo trecho"
                  onClick={() => navigate(1)}
                  disabled={selectedIndex >= timeline.length - 1}
                >
                  ›
                </button>
              </div>
            )}
            <p className="original">
              {selected?.text
                ? selected.text.split(/(\s+)/).map(renderWord)
                : snapshot.segment?.text || 'Preparando demonstração…'}
            </p>
            {snapshot.preferences.translation && (
              <p className="translation">{selected?.translation || '…'}</p>
            )}
            {snapshot.preferences.pronunciation && (
              <p className="pronunciation">{selected?.pronunciation || '…'}</p>
            )}
          </div>
        ))}
      {(error || snapshot.error) && (
        <p className="notch-error" role="alert">
          {error || snapshot.error}
        </p>
      )}
      {wordInfo &&
        createPortal(
          <div className="word-popover" role="status" style={popoverPosition}>
            <strong>{hoveredWord.split('::').at(-1)}</strong>
            <div className="popover-row">
              <strong>Significado da palavra:</strong>
              <span>{wordMeaning?.key === hoveredWord ? wordMeaning.text : 'Buscando…'}</span>
            </div>
            <div className="popover-row">
              <strong>Frase:</strong>
              <span>{hoveredSegment?.text || 'Contexto indisponível'}</span>
            </div>
            <div className="popover-row">
              <strong>Tradução:</strong>
              <span>{hoveredSegment?.translation || 'ainda indisponível'}</span>
            </div>
            <div className="popover-row">
              <strong>Pronúncia:</strong>
              <span>
                {hoveredSegment?.pronunciation || 'indisponível (léxico ainda não conectado)'}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
