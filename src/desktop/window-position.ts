import { screen, type BrowserWindow } from 'electron';
export function positionWindows(
  {
    notch,
    settingsWindow,
    quitting,
    notchHeight,
    state,
  }: {
    notch: BrowserWindow;
    settingsWindow: BrowserWindow;
    quitting: boolean;
    notchHeight: number;
    state: string;
  },
  recenter = false,
) {
  if (quitting || !notch || notch.isDestroyed()) return;
  const old = notch.getBounds();
  const area = (recenter ? screen.getPrimaryDisplay() : screen.getDisplayMatching(old)).workArea;
  const expanded = ['listening', 'starting', 'error'].includes(state);
  const width = Math.min(expanded ? 560 : 300, area.width);
  const center = recenter ? area.x + area.width / 2 : old.x + old.width / 2;
  const x = Math.max(area.x, Math.min(Math.round(center - width / 2), area.x + area.width - width));
  const y = recenter
    ? area.y + 10
    : Math.max(area.y, Math.min(old.y, area.y + area.height - notchHeight));
  if (old.width !== width || old.height !== notchHeight || recenter)
    notch.setBounds({ width, height: notchHeight, x, y });
  const panelWidth = Math.min(400, area.width);
  const panelHeight = Math.min(620, area.height - 16);
  const panel = {
    width: panelWidth,
    height: panelHeight,
    x: Math.max(
      area.x,
      Math.min(x + Math.round((width - panelWidth) / 2), area.x + area.width - panelWidth),
    ),
    y: Math.max(area.y, Math.min(y + notchHeight + 8, area.y + area.height - panelHeight)),
  };
  if (!settingsWindow || settingsWindow.isDestroyed()) return;
  const previousPanel = settingsWindow.getBounds();
  if (
    Object.entries(panel).some(([key, value]) => previousPanel[key as keyof typeof panel] !== value)
  )
    settingsWindow.setBounds(panel);
}
