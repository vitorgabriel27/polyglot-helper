import { isUserSettings, type Preferences, type UserSettings } from './preferences';
import type { TranslationStatus } from './translation';
import type { SpeechStatus } from './speech';
import type { AudioMetrics, AudioSource } from './audio';
export type { Preferences, UserSettings } from './preferences';
import type { SpeechBackend } from './speech';
import type { TranslationBackend } from './translation';

export interface AudioChunk {
  pcm: Uint8Array;
  sampleRate: 16000;
  channels: 1;
  startMs: number;
  endMs: number;
}

export interface TranscriptSegment {
  generation: number;
  segmentId: string;
  sequence: number;
  startMs: number;
  endMs: number;
  revision: number;
  text: string;
  translation: string;
  pronunciation: string;
  isFinal: boolean;
}

export type SpeechProvider = SpeechBackend;
export type TranslationProvider = TranslationBackend;

export const DESKTOP_EVENTS = {
  snapshot: 'helper:snapshot',
  command: 'helper:command',
  state: 'helper:state',
} as const;

export interface DesktopEventMap {
  [DESKTOP_EVENTS.state]: Snapshot;
}
export type DesktopEventName = keyof DesktopEventMap;

export type SessionState =
  'idle' | 'starting' | 'listening' | 'paused' | 'reconnecting' | 'error' | 'stopping';
export type Segment = TranscriptSegment;
export interface Snapshot {
  state: SessionState;
  generation: number;
  segment: Segment | null;
  recentSegments: Segment[];
  preferences: Preferences;
  settings: UserSettings;
  platform: string;
  wayland: boolean;
  shortcutAvailable: boolean;
  mode: 'simulation' | 'local-audio';
  audioSources: AudioSource[];
  sourcesLoading: boolean;
  settingsRevision: number;
  sourceError: string | null;
  error: string | null;
  metrics: AudioMetrics;
  speech: SpeechStatus;
  translation: TranslationStatus;
  modelSetup?: ModelSetupStatus;
}
export interface ModelSetupStatus {
  state: 'idle' | 'downloading' | 'ready' | 'error';
  stage: 'asr' | 'translation' | null;
  progress: number | null;
  error: string | null;
}
export type Command =
  | { type: 'toggle-session' }
  | { type: 'stop' }
  | { type: 'open-settings' }
  | { type: 'close-settings' }
  | { type: 'refresh-sources' }
  | { type: 'quit' }
  | { type: 'configure'; value: UserSettings }
  | { type: 'fit-notch'; height: number }
  | { type: 'lookup-word'; word: string }
  | {
      type: 'fit-notch-popover';
      height: number;
      baseHeight: number;
      placement: 'above' | 'below';
    };
export interface DesktopAPI {
  snapshot(): Promise<Snapshot>;
  command(command: Command): Promise<unknown>;
  subscribe(listener: (state: Snapshot) => void): () => void;
}
export function isCommand(value: unknown): value is Command {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const command = value as Record<string, unknown>;
  if (command.type === 'lookup-word') {
    return (
      Object.keys(command).length === 2 &&
      typeof command.word === 'string' &&
      command.word.length > 0 &&
      command.word.length <= 64 &&
      /^[\p{L}'-]+$/u.test(command.word)
    );
  }
  if (command.type === 'fit-notch') {
    return (
      Object.keys(command).length === 2 &&
      typeof command.height === 'number' &&
      Number.isInteger(command.height) &&
      command.height >= 50 &&
      command.height <= 4096
    );
  }
  if (command.type === 'fit-notch-popover') {
    return (
      Object.keys(command).length === 4 &&
      typeof command.height === 'number' &&
      Number.isInteger(command.height) &&
      command.height >= 50 &&
      command.height <= 4096 &&
      typeof command.baseHeight === 'number' &&
      Number.isInteger(command.baseHeight) &&
      command.baseHeight >= 50 &&
      command.baseHeight <= command.height &&
      (command.placement === 'above' || command.placement === 'below')
    );
  }
  if (Object.keys(command).some((key) => !['type', 'value'].includes(key))) return false;
  if (command.type === 'configure') return isUserSettings(command.value);
  return (
    Object.keys(command).length === 1 &&
    typeof command.type === 'string' &&
    [
      'toggle-session',
      'stop',
      'open-settings',
      'close-settings',
      'refresh-sources',
      'quit',
    ].includes(command.type)
  );
}
