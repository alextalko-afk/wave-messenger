const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

// WAVE_APP_URL points the shell at a local dev build (e.g. http://127.0.0.1:5174).
const APP_URL = process.env.WAVE_APP_URL || 'https://wave-messenger-3r2p.onrender.com';

// Google refuses to show its sign-in page to embedded browsers that announce
// themselves as Electron ("disallowed_useragent"), so present as plain Chrome.
app.userAgentFallback = app.userAgentFallback
  .replace(/\s?Electron\/\S+/, '')
  .replace(/\s?wave-desktop\/\S+/, '');

// "Sign in with Google" opens its account chooser in a popup that reports the
// result back to the page through window.opener, so that one origin has to
// open inside the app instead of being sent to the system browser.
const GOOGLE_AUTH_ORIGIN = 'https://accounts.google.com';

function isGoogleAuthUrl(url) {
  try {
    return new URL(url).origin === GOOGLE_AUTH_ORIGIN;
  } catch {
    return false;
  }
}

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

  // Open regular links in the OS browser instead of inside the app window;
  // only the Google sign-in popup stays in the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isGoogleAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: win,
          width: 480,
          height: 700,
          autoHideMenuBar: true,
          backgroundColor: '#ffffff',
          webPreferences: { contextIsolation: true, sandbox: true },
        },
      };
    }
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

// Pages inside the sign-in popup (help, privacy links...) go to the system
// browser rather than opening more app windows.
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'window') return;
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

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
