// Narrow bridge between the web app and the Electron shell. The page never
// gets ipcRenderer itself, only these three calls.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('waveDesktop', {
  // Bring the window back from the tray / minimized state.
  focus: () => ipcRenderer.send('wave:focus'),
  // Unread count plus a PNG data URL of the badge to draw over the taskbar icon.
  setBadge: (count, badgeDataUrl) => ipcRenderer.send('wave:badge', Number(count) || 0, badgeDataUrl || null),
  // Flash the taskbar button when a message arrives in the background.
  attention: () => ipcRenderer.send('wave:attention'),
});
