import type { DesktopAPI } from '../core/contracts';
declare global {
  interface Window {
    polyglotHelper: DesktopAPI;
  }
}
export const api = window.polyglotHelper;
