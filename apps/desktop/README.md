# @dropship/desktop

Thin **macOS-only** Electron wrapper around the Hearst Dropship platform.

It does **not** bundle the Next.js app — it just opens a native window pointing at the deployed Vercel URL (or a local dev server). Everything else (storefronts, API routes, auth) keeps living in `apps/web/`.

## Why

- Native macOS window + menu bar + global shortcuts for the admin console.
- Tray icon with quick-open menu (Dashboard, New store, Orders, Observability, Recent stores).
- Background anomaly watcher: a critical macOS notification when `/api/agent/ops/anomaly-watch` reports new alerts — even if no window is open.
- Opt-in `window.electron.notify(...)` bridge so the web app can fire native notifications when running inside Electron, while staying 100 % browser-compatible elsewhere.

No code-signing, no auto-update — personal use only.

## Quickstart

```bash
cd apps/desktop
npm install

# Dev mode (assumes Next dev server on :3063, or set HEARST_URL):
HEARST_URL=http://localhost:3063/admin npm run dev

# Build .app you can drag to /Applications (unsigned):
npm run package      # → release/mac/Hearst Dropship.app

# Build .dmg installer:
npm run dist         # → release/Hearst Dropship-0.1.0.dmg
```

### Environment variables

| Var               | Default                                              | Notes                                                                        |
| ----------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `HEARST_URL`      | `https://hearst-dropship.vercel.app/admin` (prod) or `http://localhost:3063/admin` (dev) | The initial URL the dashboard window opens.            |
| `ADMIN_USERNAME`  | read from `apps/web/.env.local` if present           | Required to inject HTTP Basic Auth on every request.                         |
| `ADMIN_PASSWORD`  | read from `apps/web/.env.local` if present           | Required alongside `ADMIN_USERNAME`.                                         |

The credentials are read **once at startup** and immediately encoded into the `Basic …` header kept in memory — the plaintext password is not retained.

## Keyboard shortcuts

| Shortcut         | Action                              |
| ---------------- | ----------------------------------- |
| `Cmd+Shift+D`    | Focus or open the Dashboard window  |
| `Cmd+Shift+N`    | Focus or open the New Store window  |
| `Cmd+Shift+O`    | Focus or open the Observability     |

All three are registered as global shortcuts, so they work even when the app is not focused.

## Tray menu

The menu-bar icon (macOS template image, 16×16) opens this menu:

```
Dashboard            ⇧⌘D
Create store…        ⇧⌘N
Orders
Observability        ⇧⌘O
─────────────
Recent stores ▶
─────────────
Open in browser
About Hearst Dropship
─────────────
Quit                 ⌘Q
```

`Recent stores` is populated from `~/Library/Application Support/Hearst Dropship/recent-stores.json`. The renderer can push entries via `window.electron.pushRecentStore({ id, name })`.

## Renderer bridge (`window.electron`)

The preload exposes a typed surface to the renderer. The web app stays browser-compatible by feature-detecting `window.electron`:

```ts
if (typeof window !== 'undefined' && window.electron) {
  window.electron.notify({ title: 'Sale!', body: 'New order #1234' });
  window.electron.pushRecentStore({ id: 'store_42', name: 'Cozy Candles' });
}
```

Available methods:

- `openWindow({ kind, storeId? })` — open or focus a window. Valid kinds: `dashboard`, `new-store`, `observability`, `orders`, `store-detail`.
- `notify({ title, body, urgency? })` — show a native macOS notification.
- `pushRecentStore({ id, name? })` — update the tray's Recent submenu.
- `appVersion()` — current desktop app version (sync).
- `isElectron` — always `true` in the bridge.

## Architecture

```
src/
├ main.ts             App lifecycle, menu bar, global shortcuts, IPC wiring
├ config.ts           Resolves HEARST_URL + Basic Auth header (reads apps/web/.env.local once)
├ windows.ts          Multi-window manager with kind-based deduplication
├ tray.ts             Menu-bar icon + Recent-stores submenu
├ notifications.ts    Renderer-driven notifications + anomaly-watch poller (5 min)
└ preload.ts          contextBridge → window.electron
```

The whole bundle compiles to `dist/` via `tsc`. There's no webpack/esbuild step — the main process is plain CommonJS.

## Replacing the placeholder icon

`assets/tray-icon.png` and `assets/icon.png` are generated black-silhouette placeholders. Before distributing:

1. Drop a proper `icon.icns` into `assets/` (e.g. via [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html)).
2. Replace `tray-icon.png`, `tray-icon@2x.png`, and `tray-icon@3x.png` with the menu-bar artwork. They must be **template images** (monochrome black on transparent) so macOS can invert them in dark mode.
