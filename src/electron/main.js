/**
 * AutoOC Electron Main Process
 * Creates the desktop window and (when packaged) starts the privileged backend service.
 */

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Handle Squirrel install/update/uninstall events (Windows).
// eslint-disable-next-line global-require
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;
let serviceInstance = null;
let wsAuthToken = null;

function getLogsDir() {
  return path.join(app.getPath('userData'), 'logs');
}

function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // ignore
  }
}

function getDocsUrl() {
  const envUrl = process.env.AUTOOC_DOCS_URL;
  if (envUrl && envUrl.trim()) return envUrl.trim();

  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json');
    const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgRaw);

    if (pkg.homepage && typeof pkg.homepage === 'string') return pkg.homepage;

    const repo = pkg.repository;
    if (typeof repo === 'string') return repo;
    if (repo && typeof repo.url === 'string') {
      return repo.url.replace(/^git\\+/, '').replace(/\\.git$/, '');
    }
  } catch {
    // ignore
  }

  return null;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const isDev = !app.isPackaged;
  const docsUrl = getDocsUrl();

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        ...(isMac ? [] : [{ role: 'quit' }]),
        ...(isMac ? [{ role: 'close' }] : []),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Logs Folder',
          click: async () => {
            await shell.openPath(getLogsDir());
          },
        },
        {
          label: 'Documentation',
          click: async () => {
            if (!docsUrl) {
              await dialog.showMessageBox({
                type: 'info',
                title: 'Documentation',
                message: 'Documentation URL is not configured for this build.',
                detail: 'Set AUTOOC_DOCS_URL or add a package.json "homepage" field to enable this link.',
              });
              return;
            }

            await shell.openExternal(docsUrl);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function getIconPath() {
  // BrowserWindow expects an .ico on Windows for best results.
  if (process.platform === 'win32') {
    return path.join(__dirname, '..', '..', 'assets', 'icon.ico');
  }
  return path.join(__dirname, '..', '..', 'assets', 'icon.png');
}

async function startBackendServiceIfPackaged() {
  if (!app.isPackaged) return;

  // Create per-launch token to prevent arbitrary local processes from controlling the service.
  wsAuthToken = crypto.randomBytes(32).toString('hex');
  process.env.AUTOOC_WS_TOKEN = wsAuthToken;

  // Ensure logs go somewhere writable (Program Files is not).
  const logsDir = getLogsDir();
  ensureDir(logsDir);
  process.env.AUTOOC_LOG_DIR = logsDir;

  const serviceEntry = path.join(
    app.getAppPath(),
    'dist',
    'backend',
    'service',
    'production-service.js'
  );

  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const { getService } = require(serviceEntry);
    serviceInstance = getService({
      telemetryInterval: 1000,
      enableLogging: true,
    });
    await serviceInstance.start();
  } catch (error) {
    const message =
      error && error.message
        ? error.message
        : 'Unknown error starting backend service';
    dialog.showErrorBox(
      'AutoOC failed to start',
      `${message}\n\nMake sure:\n- You are running as Administrator\n- NVIDIA drivers are installed\n- nvidia-smi is available`
    );
    throw error;
  }
}

async function stopBackendService() {
  if (!serviceInstance) return;
  try {
    await serviceInstance.stop();
  } catch {
    // ignore
  } finally {
    serviceInstance = null;
  }
}

function registerIpcHandlers() {
  ipcMain.handle('autooc:getVersion', () => app.getVersion());

  ipcMain.handle('autooc:getWsAuthToken', () => wsAuthToken || process.env.AUTOOC_WS_TOKEN || null);

  ipcMain.handle('autooc:getPaths', () => ({
    userData: app.getPath('userData'),
    logsDir: getLogsDir(),
  }));

  ipcMain.handle('autooc:openLogsFolder', async () => {
    const target = getLogsDir();
    ensureDir(target);
    await shell.openPath(target);
    return { ok: true };
  });

  ipcMain.handle('autooc:openTextFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import AutoOC Profile',
      properties: ['openFile'],
      filters: [{ name: 'AutoOC Profile', extensions: ['json'] }],
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { canceled: false, path: filePath, content };
  });

  ipcMain.handle('autooc:saveTextFile', async (_event, { defaultName, content }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export AutoOC Profile',
      defaultPath: defaultName || 'autooc-profile.json',
      filters: [{ name: 'AutoOC Profile', extensions: ['json'] }],
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    return { canceled: false, path: filePath };
  });
}

function createMainWindow() {
  const icon = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0f0f0f',
    title: 'AutoOC',
    icon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in the user's browser.
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
  void mainWindow.loadFile(indexPath);
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

app.on('ready', async () => {
  if (process.platform === 'win32') {
    // Enables notifications and proper taskbar grouping.
    app.setAppUserModelId('com.autooc.app');
  }

  registerIpcHandlers();
  buildMenu();

  try {
    await startBackendServiceIfPackaged();
  } catch {
    app.quit();
    return;
  }

  createMainWindow();
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await stopBackendService();
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  // Ensure backend stops cleanly.
  if (serviceInstance) {
    event.preventDefault();
    await stopBackendService();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});
