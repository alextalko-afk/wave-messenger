const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

const APP_URL = 'https://wave-messenger-3r2p.onrender.com';

// Electron auto-grants media requests by default, but doing it explicitly
// keeps calling reliable across Electron versions/platforms and scopes the
// grant to just mic/camera (needed for WebRTC audio/video calls) instead of
// relying on the implicit default for everything.
function allowCallMediaPermissions() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#0e1621',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadURL(APP_URL);

  // Open regular links in the OS browser instead of inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  allowCallMediaPermissions();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
