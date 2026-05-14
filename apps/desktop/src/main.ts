/**
 * Main process entry point for the Hearst Dropship desktop wrapper.
 *
 * Responsibilities:
 *   - App lifecycle (ready / window-all-closed / activate)
 *   - Inject HTTP Basic Auth on every request to the configured origin
 *   - Build the native macOS menu bar with custom items
 *   - Register global shortcuts (Cmd+Shift+D / N / O)
 *   - Wire IPC channels used by the preload bridge
 *   - Start the anomaly watcher and create the tray
 */
import {
  Menu,
  MenuItemConstructorOptions,
  app,
  globalShortcut,
  ipcMain,
  session,
  shell,
} from 'electron';

import { getConfig } from './config';
import {
  notifyFromRenderer,
  startAnomalyWatcher,
  stopAnomalyWatcher,
} from './notifications';
import { ensureNextRunning, stopNext } from './nextProcess';
import { createTray, destroyTray, pushRecentStore } from './tray';
import { closeAll, hasOpenWindows, openWindow } from './windows';

// macOS-only wrapper — bail out loudly on anything else so the user knows.
if (process.platform !== 'darwin') {
  console.error('[main] Hearst Dropship desktop is macOS-only.');
}

// Single-instance lock so Cmd+Shift+D from outside always reuses the app.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  openWindow({ kind: 'dashboard' });
});

function installAuthHeader(): void {
  const { origin, basicAuthHeader } = getConfig();
  if (!basicAuthHeader) {
    console.warn(
      '[main] No ADMIN_USERNAME/ADMIN_PASSWORD found — Basic Auth header will not be injected. ' +
        'Set them in apps/web/.env.local or as env vars before launching.',
    );
    return;
  }

  // No URL filter: Electron's pattern filter is applied before the URL is
  // fully resolved for main-frame navigations and can miss the first request.
  // We filter manually inside the callback so the header is only injected on
  // requests that target our own origin.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.startsWith(origin)) {
      details.requestHeaders.Authorization = basicAuthHeader;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

function buildAppMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Store',
          accelerator: 'Cmd+Shift+N',
          click: () => openWindow({ kind: 'new-store' }),
        },
        {
          label: 'Open Dashboard',
          accelerator: 'Cmd+Shift+D',
          click: () => openWindow({ kind: 'dashboard' }),
        },
        {
          label: 'Open Observability',
          accelerator: 'Cmd+Shift+O',
          click: () => openWindow({ kind: 'marketing' }),
        },
        {
          label: 'Open Orders',
          click: () => openWindow({ kind: 'orders' }),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Open in browser',
          click: () => {
            void shell.openExternal(getConfig().baseUrl);
          },
        },
        {
          label: 'View on GitHub',
          click: () => {
            void shell.openExternal('https://github.com/');
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function registerShortcuts(): void {
  globalShortcut.register('Cmd+Shift+D', () => openWindow({ kind: 'dashboard' }));
  globalShortcut.register('Cmd+Shift+N', () => openWindow({ kind: 'new-store' }));
  globalShortcut.register('Cmd+Shift+O', () => openWindow({ kind: 'marketing' }));
}

function wireIpc(): void {
  ipcMain.on('config:get-auth', (event) => {
    event.returnValue = getConfig().basicAuthHeader ?? null;
  });


  ipcMain.handle(
    'window:open',
    (_event, opts: { kind: string; storeId?: string }) => {
      // Validate the kind here — the preload type is `string` so we can't trust
      // it at the boundary.
      const validKinds = new Set([
        'dashboard',
        'new-store',
        'marketing',
        'orders',
        'store-detail',
      ]);
      if (!validKinds.has(opts.kind)) {
        throw new Error(`Unknown window kind: ${opts.kind}`);
      }
      openWindow({ kind: opts.kind as never, storeId: opts.storeId });
    },
  );

  ipcMain.handle(
    'notify:show',
    (_event, opts: { title: string; body: string; urgency?: 'normal' | 'critical' }) => {
      if (typeof opts?.title !== 'string' || typeof opts?.body !== 'string') {
        throw new Error('notify: title and body are required strings');
      }
      return notifyFromRenderer(opts);
    },
  );

  ipcMain.handle(
    'recent-store:push',
    (_event, opts: { id: string; name?: string }) => {
      if (typeof opts?.id !== 'string' || !opts.id.length) {
        throw new Error('recent-store:push: id is required');
      }
      pushRecentStore({ id: opts.id, name: opts.name });
    },
  );

  ipcMain.on('app:version-sync', (event) => {
    event.returnValue = app.getVersion();
  });

  ipcMain.handle('window:control', (event, action: 'close' | 'minimize' | 'maximize') => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (action === 'close') win.close();
    else if (action === 'minimize') win.minimize();
    else if (action === 'maximize') {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });
}

app.on('ready', async () => {
  app.setName('Hearst Dropship');
  installAuthHeader();
  Menu.setApplicationMenu(buildAppMenu());
  registerShortcuts();
  wireIpc();
  createTray();
  startAnomalyWatcher();

  // In dev, embed Next.js as a child process and wait for it to be ready
  // before opening the dashboard. In prod, we hit Vercel directly so this
  // step is skipped. ALL errors are surfaced in a dedicated splash window
  // so the user never sees a blank / crashing main window.
  const cfg = getConfig();
  if (cfg.isDev && cfg.isLocal) {
    try {
      await ensureNextRunning({
        timeoutMs: 90_000,
        onProgress: (msg) => console.log('[startup]', msg),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[startup] Next.js failed to start:', message);
      const { dialog } = require('electron') as typeof import('electron');
      // Show a native error dialog so the user sees exactly whats wrong
      // instead of staring at a black/empty window.
      dialog.showErrorBox(
        'Next.js n a pas démarré',
        `Le serveur de développement n a pas répondu sur le port 4302.\n\n${message}\n\nVérifie /tmp/hdrop-next.log ou lance manuellement :\n  cd apps/web && npm run dev`,
      );
      // Open the window anyway — Cmd+R will retry once the user fixes things.
    }
  }

  openWindow({ kind: 'dashboard' });
  // Force foreground after window creation
  app.focus({ steal: true });
});

// macOS convention: keep the app running even with no windows.
app.on('window-all-closed', () => {
  // Intentionally do nothing — the tray + menu bar keep the app alive.
});

// Dock click with no windows open → reopen the dashboard.
app.on('activate', () => {
  if (!hasOpenWindows()) {
    openWindow({ kind: 'dashboard' });
  }
});

app.on('will-quit', async (event) => {
  globalShortcut.unregisterAll();
  stopAnomalyWatcher();
  destroyTray();
  closeAll();

  // Kill the embedded Next.js dev server cleanly. We need to delay the
  // actual quit until SIGTERM/SIGKILL completes so it doesnt linger.
  if (getConfig().isDev) {
    event.preventDefault();
    await stopNext();
    app.exit(0);
  }
});
