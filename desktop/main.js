const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, session } = require('electron');
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
  // 'notifications' lets the app show system toasts for background messages.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'notifications');
  });
}

let mainWindow = null;
let tray = null;
let quitting = false;

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// Closing the window keeps Wave running in the tray so messages still arrive;
// "Выйти" in the tray menu really quits.
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Wave');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть Wave', click: showWindow },
      { type: 'separator' },
      {
        label: 'Выйти',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', showWindow);
}

ipcMain.on('wave:focus', showWindow);

ipcMain.on('wave:badge', (event, count, dataUrl) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  // Windows draws an overlay on the taskbar icon; macOS/Linux use the badge count.
  if (process.platform === 'win32') {
    const image = dataUrl && count > 0 ? nativeImage.createFromDataURL(dataUrl) : null;
    mainWindow.setOverlayIcon(image, count > 0 ? `${count} непрочитанных` : '');
  } else {
    app.setBadgeCount(count);
  }
  tray?.setToolTip(count > 0 ? `Wave — ${count} непрочитанных` : 'Wave');
});

ipcMain.on('wave:attention', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || mainWindow.isFocused()) return;
  mainWindow.flashFrame(true);
});

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
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow = win;

  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on('focus', () => win.flashFrame(false));

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

// One Wave at a time: a second launch just brings the first back.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on('second-instance', showWindow);

app.on('before-quit', () => {
  quitting = true;
});

app.whenReady().then(() => {
  if (!gotLock) return;
  app.setAppUserModelId('com.wave.messenger.desktop'); // required for Windows toasts
  Menu.setApplicationMenu(null);
  allowCallMediaPermissions();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
