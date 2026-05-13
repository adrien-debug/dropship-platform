/**
 * macOS menu-bar tray icon + menu.
 *
 * The "Recent stores" submenu is populated from
 *   <userData>/recent-stores.json
 * which the renderer updates via the `recent-store:push` IPC channel whenever
 * the platform loads a store detail page.
 */
import { Menu, MenuItemConstructorOptions, Tray, app, nativeImage, shell } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getConfig } from './config';
import { openWindow } from './windows';

const RECENT_FILENAME = 'recent-stores.json';
const MAX_RECENT = 8;

interface RecentStore {
  id: string;
  name?: string;
  lastOpenedAt: string;
}

let tray: Tray | null = null;

function recentFilePath(): string {
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return path.join(dir, RECENT_FILENAME);
}

function loadRecentStores(): RecentStore[] {
  try {
    const raw = readFileSync(recentFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as RecentStore[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function pushRecentStore(entry: { id: string; name?: string }): void {
  if (!entry.id) return;
  const list = loadRecentStores().filter((s) => s.id !== entry.id);
  list.unshift({ id: entry.id, name: entry.name, lastOpenedAt: new Date().toISOString() });
  const trimmed = list.slice(0, MAX_RECENT);
  try {
    writeFileSync(recentFilePath(), JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (err) {
    console.error('[tray] failed to persist recent stores', err);
  }
  rebuildMenu();
}

function trayIconPath(): string {
  // Packaged: assets/ sit next to dist/. Unpackaged: same.
  return path.join(__dirname, '..', 'assets', 'tray-icon.png');
}

function buildMenu(): Menu {
  const recent = loadRecentStores();
  const recentSubmenu: MenuItemConstructorOptions[] = recent.length
    ? recent.map((store) => ({
        label: store.name ? `${store.name} (${store.id.slice(0, 6)})` : store.id,
        click: () => openWindow({ kind: 'store-detail', storeId: store.id }),
      }))
    : [{ label: 'No recent stores', enabled: false }];

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Dashboard',
      accelerator: 'Cmd+Shift+D',
      click: () => openWindow({ kind: 'dashboard' }),
    },
    {
      label: 'Create store…',
      accelerator: 'Cmd+Shift+N',
      click: () => openWindow({ kind: 'new-store' }),
    },
    {
      label: 'Orders',
      click: () => openWindow({ kind: 'orders' }),
    },
    {
      label: 'Observability',
      accelerator: 'Cmd+Shift+O',
      click: () => openWindow({ kind: 'marketing' }),
    },
    { type: 'separator' },
    {
      label: 'Recent stores',
      submenu: recentSubmenu,
    },
    { type: 'separator' },
    {
      label: 'Open in browser',
      click: () => {
        void shell.openExternal(getConfig().baseUrl);
      },
    },
    {
      label: 'About Hearst Dropship',
      role: 'about',
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'Cmd+Q',
      click: () => app.quit(),
    },
  ];
  return Menu.buildFromTemplate(template);
}

function rebuildMenu(): void {
  if (!tray) return;
  tray.setContextMenu(buildMenu());
}

export function createTray(): Tray {
  if (tray) return tray;

  let image = nativeImage.createFromPath(trayIconPath());
  if (image.isEmpty()) {
    // Fall back to an empty 16x16 placeholder so we still have a tray.
    image = nativeImage.createEmpty();
  } else {
    // macOS template image — auto-inverts in dark/light menubar.
    image.setTemplateImage(true);
  }

  tray = new Tray(image);
  tray.setToolTip('Hearst Dropship');
  tray.setContextMenu(buildMenu());

  // Left click on macOS: also open the menu (so the icon always feels active).
  tray.on('click', () => {
    tray?.popUpContextMenu();
  });

  return tray;
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
}
