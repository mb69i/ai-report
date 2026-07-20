/**
 * Atlas – Electron Main Process
 *
 * Responsibilities:
 * - Create and manage the main BrowserWindow
 * - Spawn the Python FastAPI backend as a child process
 * - Manage system tray
 * - Handle app lifecycle (quit, crash recovery)
 * - Expose IPC channels to the renderer via preload
 */

const { app, BrowserWindow, ipcMain, Menu, Tray, shell, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

// ── Configuration ─────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, '..', 'atlas.config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const BACKEND_PORT = config.backend.port || 7411;
const BACKEND_URL = `http://${config.backend.host}:${BACKEND_PORT}`;
const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged;
const UI_URL = IS_DEV ? 'http://localhost:5173' : `file://${path.join(__dirname, '..', 'ui', 'dist', 'index.html')}`;

let mainWindow = null;
let tray = null;
let backendProcess = null;

// ── Backend Management ────────────────────────────────────────────────────────

/**
 * Start the Python FastAPI backend as a child process.
 * Waits until the backend is healthy before loading the UI.
 */
function startBackend() {
  const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
  const backendEntry = path.join(__dirname, '..', 'backend', 'main.py');

  console.log('[Atlas] Starting Python backend...');

  backendProcess = spawn(pythonExe, [backendEntry], {
    env: {
      ...process.env,
      ATLAS_PORT: String(BACKEND_PORT),
      ATLAS_CONFIG: CONFIG_PATH,
    },
    cwd: path.join(__dirname, '..'),
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend ERR] ${data.toString().trim()}`);
  });

  backendProcess.on('exit', (code) => {
    console.log(`[Atlas] Backend exited with code ${code}`);
  });
}

/**
 * Poll until the backend health endpoint responds, then resolve.
 */
function waitForBackend(maxRetries = 30, intervalMs = 1000) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const check = () => {
      http.get(`${BACKEND_URL}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('[Atlas] Backend is ready.');
          resolve();
        } else {
          retry();
        }
      }).on('error', () => retry());
    };
    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error('Backend failed to start in time.'));
      } else {
        setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

// ── Window Management ─────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Atlas',
    backgroundColor: '#0f0f14',
    show: false,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadURL(UI_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('close', (e) => {
    // On close, minimize to tray instead of quitting
    if (tray && process.platform !== 'darwin') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── System Tray ───────────────────────────────────────────────────────────────

function createTray() {
  // Use a placeholder icon path — will be replaced by actual icon in assets/
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  if (!fs.existsSync(iconPath)) return; // Skip tray if no icon yet

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Atlas', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Quit Atlas', click: () => { app.quit(); } },
  ]);
  tray.setToolTip('Atlas – Automation Platform');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  // Proxy HTTP requests from renderer → backend
  // (The renderer calls window.atlas.api() which goes through preload → IPC → here)

  ipcMain.handle('atlas:getConfig', () => config);

  ipcMain.handle('atlas:openExternal', (_, url) => shell.openExternal(url));

  ipcMain.handle('atlas:showSaveDialog', async (_, options) => {
    return dialog.showSaveDialog(mainWindow, options);
  });

  ipcMain.handle('atlas:showOpenDialog', async (_, options) => {
    return dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle('atlas:getBackendUrl', () => BACKEND_URL);

  ipcMain.handle('atlas:restartBackend', async () => {
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
    startBackend();
    await waitForBackend();
    return { ok: true };
  });
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  registerIpcHandlers();

  if (config.backend.auto_start) {
    startBackend();
    try {
      await waitForBackend();
    } catch (err) {
      dialog.showErrorBox('Atlas – Backend Error', `Failed to start backend: ${err.message}`);
    }
  }

  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  // Allow window close on quit
  if (mainWindow) mainWindow.removeAllListeners('close');
});

app.on('will-quit', () => {
  if (backendProcess) {
    console.log('[Atlas] Killing backend process...');
    backendProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Windows/Linux: do NOT quit — backend still running, tray active
    // Actual quit happens from tray menu
  }
});
