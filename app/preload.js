/**
 * Atlas – Electron Preload Script (Context Bridge)
 *
 * Exposes a safe, typed API surface to the React renderer process.
 * The renderer CANNOT access Node.js directly — it uses window.atlas instead.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('atlas', {
  // ── Configuration ──────────────────────────────────────────────────────────
  getConfig: () => ipcRenderer.invoke('atlas:getConfig'),
  getBackendUrl: () => ipcRenderer.invoke('atlas:getBackendUrl'),

  // ── Shell ──────────────────────────────────────────────────────────────────
  openExternal: (url) => ipcRenderer.invoke('atlas:openExternal', url),

  // ── File Dialogs ───────────────────────────────────────────────────────────
  showSaveDialog: (options) => ipcRenderer.invoke('atlas:showSaveDialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('atlas:showOpenDialog', options),

  // ── Backend Control ────────────────────────────────────────────────────────
  restartBackend: () => ipcRenderer.invoke('atlas:restartBackend'),

  // ── Event Listeners (main → renderer) ─────────────────────────────────────
  on: (channel, callback) => {
    const validChannels = [
      'atlas:progress',
      'atlas:notification',
      'atlas:backend-status',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    }
  },

  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
});
