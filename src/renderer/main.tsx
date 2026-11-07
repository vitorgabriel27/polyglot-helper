import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { create } from 'zustand';
import type { Command, DesktopAPI, Snapshot, UserSettings } from '../core/contracts';
import './style.css';

declare global { interface Window { polyglotHelper: DesktopAPI } }
const useSnapshot = create<{ snapshot: Snapshot | null; update: (snapshot: Snapshot) => void }>(set => ({ snapshot: null, update: snapshot => set({ snapshot }) }));
const api = window.polyglotHelper;
function App() {
  const { snapshot, update } = useSnapshot();
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const isSettings = new URLSearchParams(window.location.search).get('view') === 'settings';
  const command = (value: Command) => api.command(value).catch(cause => setError(cause instanceof Error ? cause.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Não foi possível executar esta ação.'));
  const settingsKey = snapshot ? JSON.stringify(snapshot.settings) : '';
  useEffect(() => { if (settingsKey) setDraft(JSON.parse(settingsKey) as UserSettings); }, [settingsKey, snapshot?.settingsRevision]);
  useEffect(() => {
    let receivedUpdate = false;
    const unsubscribe = api.subscribe(state => { receivedUpdate = true; update(state); });
    api.snapshot().then(state => { if (!receivedUpdate) update(state); }).catch(() => setError('Falha ao conectar ao aplicativo.'));
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && isSettings) void api.command({ type: 'close-settings' }); };
    window.addEventListener('keydown', onKey);
    return () => { unsubscribe(); window.removeEventListener('keydown', onKey); };
  }, [isSettings, update]);
  const loaded = snapshot !== null && draft !== null;
  useEffect(() => {
    if (isSettings || !loaded) return;
    const surface = document.querySelector('.notch');
    if (!surface) return;
    const observer = new ResizeObserver(() => {
      const height = Math.max(50, Math.min(300, Math.ceil(surface.getBoundingClientRect().height + 6)));
      void api.command({ type: 'fit-notch', height }).catch(() => setError('Falha ao ajustar a janela.'));
    });
    observer.observe(surface);
    return () => observer.disconnect();
  }, [isSettings, loaded]);
  if (!snapshot || !draft) return <div className="loading" role="status">{error || 'PolyglotHelper…'}</div>;
  const active = snapshot.state === 'listening';
  const busy = active || snapshot.state === 'starting';
  const isAudio = snapshot.mode === 'local-audio';
  const missingSource = draft.sourceId !== null && !snapshot.audioSources.some(source => source.id === draft.sourceId);
  const save = async () => {
    setSaving(true); setError('');
    try { await api.command({ type: 'configure', value: { ...draft, onboardingComplete: true } }); }
    catch (cause) { setError(cause instanceof Error ? cause.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };
  if (isSettings) return <section className="settings" aria-label="Configurações rápidas">
    <header><div><span className="eyebrow">POLYGLOTHELPER</span><h1>{snapshot.settings.onboardingComplete ? 'Do seu jeito.' : 'Vamos começar.'}</h1></div><button aria-label="Fechar configurações" onClick={() => void command({ type: 'close-settings' })}>×</button></header>
    <p className="notice">{snapshot.settings.onboardingComplete ? 'Preferências salvas neste computador.' : 'Escolha uma vez. Você pode mudar depois.'}</p>
    <div className="field"><span>Idioma</span><strong>Inglês → Português</strong></div>
    <label className="source-field"><span>Fonte de áudio</span><select value={draft.sourceId ?? ''} onChange={event => setDraft({ ...draft, sourceId: event.target.value || null })}>
      <option value="">Demonstração (sem captura)</option>
      {missingSource && <option value={draft.sourceId!} disabled>Fonte salva indisponível</option>}
      {snapshot.audioSources.map(source => <option key={source.id} value={source.id}>{source.kind === 'system' ? 'Sistema' : 'Microfone'} — {source.label}</option>)}
    </select></label>
    <div className="source-refresh"><button type="button" disabled={snapshot.sourcesLoading} onClick={() => void command({ type: 'refresh-sources' })}>{snapshot.sourcesLoading ? 'Procurando…' : 'Atualizar fontes'}</button></div>
    {snapshot.sourceError && <p className="hint">{snapshot.sourceError}</p>}
    {missingSource && !snapshot.sourcesLoading && <p className="hint">Conecte a fonte salva ou escolha outra. Não trocaremos para outro dispositivo automaticamente.</p>}
    <label className="field"><span>Tradução</span><input type="checkbox" checked={draft.preferences.translation} onChange={event => setDraft({ ...draft, preferences: { ...draft.preferences, translation: event.target.checked } })} /></label>
    <label className="field"><span>Pronúncia em IPA</span><input type="checkbox" checked={draft.preferences.pronunciation} onChange={event => setDraft({ ...draft, preferences: { ...draft.preferences, pronunciation: event.target.checked } })} /></label>
    <label className="field"><span>Tamanho da legenda</span><select value={draft.preferences.fontSize} onChange={event => setDraft({ ...draft, preferences: { ...draft.preferences, fontSize: event.target.value === 'large' ? 'large' : 'normal' } })}><option value="normal">Normal</option><option value="large">Grande</option></select></label>
    <label className="field"><span>Iniciar com o sistema</span><input type="checkbox" checked={draft.launchAtLogin} onChange={event => setDraft({ ...draft, launchAtLogin: event.target.checked })} /></label>
    <p className="hint">Abre o assistente ao entrar na sessão. A captura só começa quando você clicar em Iniciar.</p>
    <div className="actions"><button className="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Salvando…' : snapshot.settings.onboardingComplete ? 'Salvar' : 'Salvar e continuar'}</button>
      {snapshot.settings.onboardingComplete && <><button onClick={() => void command({ type: 'toggle-session' })}>{busy ? 'Pausar' : isAudio ? 'Iniciar captura' : 'Iniciar demonstração'}</button><button onClick={() => void command({ type: 'stop' })}>Parar</button></>}
      <button onClick={() => void command({ type: 'quit' })}>Sair</button></div>
    <p className="hint">{draft.sourceId ? 'Reconhecimento de inglês no próprio computador. Nenhum áudio é gravado em arquivo ou enviado à nuvem. Tradução e IPA reais ainda em preparação.' : 'Demonstração com frases de exemplo. Modelos e APIs ainda não conectados.'}</p>
    {draft.sourceId && !snapshot.speech.available && <p className="hint">O reconhecimento local ainda não foi preparado neste computador. Consulte o guia de instalação.</p>}
    {snapshot.shortcutAvailable && <p className="hint">Ctrl + Shift + Espaço · pausar ou retomar</p>}
    {snapshot.wayland && <p className="hint">Wayland nativo: o desktop pode limitar a sobreposição. O modo padrão usa XWayland quando disponível.</p>}
    {(error || snapshot.error) && <p role="alert">{error || snapshot.error}</p>}
  </section>;
  const transportLabel = busy ? (isAudio ? 'Pausar captura' : 'Pausar demonstração') : (isAudio ? 'Iniciar captura' : 'Iniciar demonstração');
  return <section className={`notch ${busy || snapshot.state === 'error' ? 'active' : ''} ${snapshot.preferences.fontSize}`} aria-label="PolyglotHelper">
    <div className="notch-bar"><span className="grip" aria-hidden="true">⠿</span><button className="identity" aria-label="Abrir configurações" onClick={() => void command({ type: 'open-settings' })}><span className={`dot ${active ? 'live' : ''}`} /><span>PolyglotHelper</span></button><span className="badge">{isAudio ? snapshot.state === 'starting' ? 'ABRINDO' : active ? 'LOCAL' : 'ÁUDIO' : 'DEMO'}</span><button className="transport" aria-label={transportLabel} onClick={() => void command({ type: 'toggle-session' })}>{busy ? 'Ⅱ' : '▶'}</button></div>
    {busy && (isAudio ? <div className="captions live-captions" aria-live="polite" aria-atomic="true">
      <p className="original">{snapshot.segment?.text || (snapshot.state === 'starting' ? 'Preparando reconhecimento local…' : 'Ouvindo…')}</p>
      <div className="live-status"><meter aria-label="Nível do áudio" min={0} max={1} value={snapshot.metrics.rms} /><span>{snapshot.speech.state === 'transcribing' ? 'Reconhecendo' : 'Inglês · local'}</span></div>
      {snapshot.speech.dropped > 0 && <p className="hint">O áudio está mais rápido que o reconhecimento. Alguns trechos foram ignorados para acompanhar o conteúdo atual.</p>}
    </div> : <div className="captions" aria-live="polite" aria-atomic="true"><p className="original">{snapshot.segment?.text || 'Preparando demonstração…'}</p>{snapshot.preferences.translation && <p className="translation">{snapshot.segment?.translation || '…'}</p>}{snapshot.preferences.pronunciation && <p className="pronunciation">{snapshot.segment?.pronunciation || '…'}</p>}</div>)}
    {(error || snapshot.error) && <p className="notch-error" role="alert">{error || snapshot.error}</p>}
  </section>;
}
createRoot(document.getElementById('root')!).render(<App />);
