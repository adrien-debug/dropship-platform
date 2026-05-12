/**
 * Multi-window manager.
 *
 * Each "kind" of window maps to a fixed URL path inside the platform.
 * Reusing a window of the same kind (and same storeId for store-detail) is
 * preferred over opening a duplicate.
 */
import { BrowserWindow, shell } from 'electron';
import path from 'node:path';

import { urlForPath } from './config';

export type WindowKind =
  | 'dashboard'
  | 'new-store'
  | 'observability'
  | 'orders'
  | 'store-detail';

export interface OpenWindowOptions {
  kind: WindowKind;
  /** Required for kind === 'store-detail'. */
  storeId?: string;
  /** Default true — focus the window if it already exists. */
  bringToFront?: boolean;
}

interface TrackedWindow {
  kind: WindowKind;
  storeId?: string;
  window: BrowserWindow;
}

const tracked = new Set<TrackedWindow>();

function pathForKind(kind: WindowKind, storeId?: string): string {
  switch (kind) {
    case 'dashboard':
      return '/admin';
    case 'new-store':
      return '/admin/stores/new';
    case 'observability':
      return '/admin/observability';
    case 'orders':
      return '/admin/orders';
    case 'store-detail': {
      if (!storeId) {
        throw new Error("openWindow: 'store-detail' requires a storeId");
      }
      return `/admin/stores/${encodeURIComponent(storeId)}/copilot`;
    }
    default: {
      // Exhaustive check.
      const _exhaustive: never = kind;
      throw new Error(`openWindow: unknown kind ${String(_exhaustive)}`);
    }
  }
}

function titleForKind(kind: WindowKind, storeId?: string): string {
  switch (kind) {
    case 'dashboard':
      return 'Hearst Dropship — Dashboard';
    case 'new-store':
      return 'Hearst Dropship — New store';
    case 'observability':
      return 'Hearst Dropship — Observability';
    case 'orders':
      return 'Hearst Dropship — Orders';
    case 'store-detail':
      return `Hearst Dropship — Store ${storeId ?? ''}`;
    default:
      return 'Hearst Dropship';
  }
}

function findExisting(kind: WindowKind, storeId?: string): BrowserWindow | null {
  for (const entry of tracked) {
    if (entry.window.isDestroyed()) continue;
    if (entry.kind !== kind) continue;
    if (kind === 'store-detail' && entry.storeId !== storeId) continue;
    return entry.window;
  }
  return null;
}

export function openWindow(opts: OpenWindowOptions): BrowserWindow {
  const { kind, storeId } = opts;
  const bringToFront = opts.bringToFront !== false;

  const existing = findExisting(kind, storeId);
  if (existing) {
    if (bringToFront) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
    }
    return existing;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: titleForKind(kind, storeId),
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#0b0b0c',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const entry: TrackedWindow = { kind, storeId, window: win };
  tracked.add(entry);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    tracked.delete(entry);
  });

  // Open external links (anything outside our origin) in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const targetUrl = urlForPath(pathForKind(kind, storeId));
  void win.loadURL(targetUrl);

  return win;
}

export function getOpenWindows(): BrowserWindow[] {
  return Array.from(tracked)
    .filter((entry) => !entry.window.isDestroyed())
    .map((entry) => entry.window);
}

export function closeAll(): void {
  for (const entry of Array.from(tracked)) {
    if (!entry.window.isDestroyed()) {
      entry.window.close();
    }
  }
  tracked.clear();
}

/** True when at least one tracked window is still open. */
export function hasOpenWindows(): boolean {
  return getOpenWindows().length > 0;
}
