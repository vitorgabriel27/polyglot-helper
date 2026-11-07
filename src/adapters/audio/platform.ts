import type { AudioBackend } from '../../core/audio';
import { PipeWireAudio } from './pipewire';
export function platformAudio(): AudioBackend {
  if (process.platform === 'linux') return new PipeWireAudio();
  // Keep the Windows build runnable while its loopback integration is implemented/tested natively.
  return {
    listSources: async () => { throw new Error('Captura Windows ainda não integrada. Use a demonstração nesta versão.'); },
    start: async () => { throw new Error('Captura indisponível nesta plataforma.'); },
  };
}
