/**
 * Two responsibilities:
 *   A. Forward web-app notifications. The renderer calls
 *      window.electron.notify({title, body}) which proxies to here.
 *   B. Background anomaly watcher. Polls /api/agent/ops/anomaly-watch every 5
 *      minutes with the configured Basic-Auth header and surfaces critical
 *      notifications only for *new* anomaly IDs (no spam).
 *
 * Critical notifications keep showing the macOS banner until the user
 * interacts with them. Clicking a notification opens the Observability window.
 */
import { Notification, app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getConfig, urlForPath } from './config';
import { openWindow } from './windows';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const STATE_FILENAME = 'anomaly-state.json';

interface AnomalyState {
  seenIds: string[];
  lastPolledAt: string | null;
}

interface AnomalyAlert {
  id: string;
  title?: string;
  message?: string;
  severity?: string;
  storeId?: string;
}

interface AnomalyResponse {
  total?: number;
  alerts?: AnomalyAlert[];
}

let pollTimer: NodeJS.Timeout | null = null;

function stateFilePath(): string {
  const dir = app.getPath('userData');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, STATE_FILENAME);
}

function loadState(): AnomalyState {
  try {
    const raw = readFileSync(stateFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as AnomalyState;
    return {
      seenIds: Array.isArray(parsed.seenIds) ? parsed.seenIds : [],
      lastPolledAt: typeof parsed.lastPolledAt === 'string' ? parsed.lastPolledAt : null,
    };
  } catch {
    return { seenIds: [], lastPolledAt: null };
  }
}

function saveState(state: AnomalyState): void {
  try {
    writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[notifications] failed to persist anomaly state', err);
  }
}

/**
 * Forward a renderer-initiated notification to macOS.
 * Returns true if the notification was actually shown.
 */
export function notifyFromRenderer(opts: {
  title: string;
  body: string;
  urgency?: 'normal' | 'critical';
}): boolean {
  if (!Notification.isSupported()) return false;
  const notification = new Notification({
    title: opts.title,
    body: opts.body,
    urgency: opts.urgency ?? 'normal',
    silent: false,
  });
  notification.show();
  return true;
}

function showAnomalyNotification(newAlerts: AnomalyAlert[]): void {
  if (!Notification.isSupported() || newAlerts.length === 0) return;

  const title =
    newAlerts.length === 1
      ? `Anomaly detected: ${newAlerts[0]?.title ?? newAlerts[0]?.id ?? 'unknown'}`
      : `${newAlerts.length} new anomalies detected`;
  const bodyParts = newAlerts
    .slice(0, 3)
    .map((a) => a.message ?? a.title ?? a.id)
    .filter(Boolean);
  if (newAlerts.length > 3) bodyParts.push(`+${newAlerts.length - 3} more`);

  const notification = new Notification({
    title,
    body: bodyParts.join('\n') || 'Open Observability to investigate.',
    urgency: 'critical',
  });
  notification.on('click', () => {
    openWindow({ kind: 'marketing' });
  });
  notification.show();
}

async function pollOnce(): Promise<void> {
  const { basicAuthHeader } = getConfig();
  const url = urlForPath('/api/agent/ops/anomaly-watch');

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (basicAuthHeader) headers.Authorization = basicAuthHeader;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[notifications] anomaly-watch HTTP ${res.status}`);
      return;
    }
    const data = (await res.json()) as AnomalyResponse;
    const total = typeof data.total === 'number' ? data.total : (data.alerts?.length ?? 0);
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];

    const state = loadState();
    const seen = new Set(state.seenIds);
    const newOnes = alerts.filter((a) => a.id && !seen.has(a.id));

    if (total > 0 && newOnes.length > 0) {
      showAnomalyNotification(newOnes);
    }

    // Keep the seen set bounded — last 500 ids is plenty.
    const merged = Array.from(new Set([...state.seenIds, ...alerts.map((a) => a.id).filter(Boolean)]));
    const trimmed = merged.slice(-500);

    saveState({ seenIds: trimmed, lastPolledAt: new Date().toISOString() });
  } catch (err) {
    console.warn('[notifications] anomaly-watch fetch failed', err);
  }
}

export function startAnomalyWatcher(): void {
  if (pollTimer) return;
  // Stagger the first poll slightly so the dashboard window opens first.
  setTimeout(() => {
    void pollOnce();
  }, 10_000);
  pollTimer = setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL_MS);
}

export function stopAnomalyWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
