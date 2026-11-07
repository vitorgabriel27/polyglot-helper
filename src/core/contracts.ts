import { isUserSettings, type Preferences, type UserSettings } from './preferences';
import type { TranslationStatus } from './translation';
import type { SpeechStatus } from './speech';
import type { AudioMetrics, AudioSource } from './audio';
export type { Preferences, UserSettings } from './preferences';
export type SessionState =
  'idle' | 'starting' | 'listening' | 'paused' | 'reconnecting' | 'error' | 'stopping';
export interface Segment {
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
export interface Snapshot {
  state: SessionState;
  generation: number;
  segment: Segment | null;
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
}
export type Command =
  | { type: 'toggle-session' }
  | { type: 'stop' }
  | { type: 'open-settings' }
  | { type: 'close-settings' }
  | { type: 'refresh-sources' }
  | { type: 'quit' }
  | { type: 'configure'; value: UserSettings }
  | { type: 'fit-notch'; height: number };
export interface DesktopAPI {
  snapshot(): Promise<Snapshot>;
  command(command: Command): Promise<void>;
  subscribe(listener: (state: Snapshot) => void): () => void;
}
export function isCommand(value: unknown): value is Command {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const command = value as Record<string, unknown>;
  if (command.type === 'fit-notch') {
    return (
      Object.keys(command).length === 2 &&
      typeof command.height === 'number' &&
      Number.isInteger(command.height) &&
      command.height >= 50 &&
      command.height <= 300
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
