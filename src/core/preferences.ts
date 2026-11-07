export interface Preferences {
  translation: boolean;
  pronunciation: boolean;
  fontSize: 'normal' | 'large';
}
export interface UserSettings {
  version: 1;
  onboardingComplete: boolean;
  sourceId: string | null;
  launchAtLogin: boolean;
  preferences: Preferences;
}
export function defaults(): UserSettings {
  return { version: 1, onboardingComplete: false, sourceId: null, launchAtLogin: false,
    preferences: { translation: true, pronunciation: false, fontSize: 'normal' } };
}
export function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return Object.keys(p).length === 3 && typeof p.translation === 'boolean'
    && typeof p.pronunciation === 'boolean' && (p.fontSize === 'normal' || p.fontSize === 'large');
}
export function isSourceId(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= 1024 && ![...value].some(character => character.charCodeAt(0) < 32));
}
export function isUserSettings(value: unknown): value is UserSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return Object.keys(s).length === 5 && s.version === 1 && typeof s.onboardingComplete === 'boolean'
    && typeof s.launchAtLogin === 'boolean' && isSourceId(s.sourceId) && isPreferences(s.preferences);
}
