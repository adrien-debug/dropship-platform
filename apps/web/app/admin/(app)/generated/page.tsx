import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface ImageEntry {
  filename: string;
  url: string;
  bytes: number;
  mtime: number;
  kind: 'image' | 'video' | 'audio';
}

const MEDIA_RE = /\.(png|jpe?g|webp|mp4|webm|mov|wav|mp3|ogg)$/i;
function classify(filename: string): ImageEntry['kind'] | null {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  if (['png', 'jpg', 'jpeg', 'webp'].includes(m[1])) return 'image';
  if (['mp4', 'webm', 'mov'].includes(m[1])) return 'video';
  if (['wav', 'mp3', 'ogg'].includes(m[1])) return 'audio';
  return null;
}

interface RunEntry {
  runId: string;
  images: ImageEntry[];
  totalBytes: number;
  latestMtime: number;
}

interface StoreEntry {
  store: string;
  runs: RunEntry[];
  totalImages: number;
}

/**
 * Walk public/generated/{store}/{run}/{*.png}.
 * Tolerant of legacy flat layout: PNGs sitting directly in {store}/ get
 * surfaced as a virtual run called "legacy" so nothing disappears mid-migration.
 */
async function listStores(): Promise<StoreEntry[]> {
  const root = path.join(process.cwd(), 'public', 'generated');
  const stores: StoreEntry[] = [];
  let storeDirs: string[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    storeDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return stores;
  }

  for (const store of storeDirs) {
    const storeAbs = path.join(root, store);
    const children = await fs.readdir(storeAbs, { withFileTypes: true });
    const runs: RunEntry[] = [];
    const orphanImages: ImageEntry[] = [];

    for (const child of children) {
      if (child.isDirectory()) {
        const runAbs = path.join(storeAbs, child.name);
        const files = await fs.readdir(runAbs);
        const images: ImageEntry[] = [];
        for (const f of files) {
          const kind = classify(f);
          if (!kind) continue;
          const stat = await fs.stat(path.join(runAbs, f));
          images.push({
            filename: f,
            url: `/generated/${store}/${child.name}/${f}`,
            bytes: stat.size,
            mtime: stat.mtimeMs,
            kind,
          });
        }
        if (images.length > 0) {
          runs.push({
            runId: child.name,
            images: images.sort((a, b) => b.mtime - a.mtime),
            totalBytes: images.reduce((acc, i) => acc + i.bytes, 0),
            latestMtime: Math.max(...images.map((i) => i.mtime)),
          });
        }
      } else if (MEDIA_RE.test(child.name)) {
        const kind = classify(child.name);
        if (!kind) continue;
        const stat = await fs.stat(path.join(storeAbs, child.name));
        orphanImages.push({
          filename: child.name,
          url: `/generated/${store}/${child.name}`,
          bytes: stat.size,
          mtime: stat.mtimeMs,
          kind,
        });
      }
    }

    if (orphanImages.length > 0) {
      runs.push({
        runId: 'legacy',
        images: orphanImages.sort((a, b) => b.mtime - a.mtime),
        totalBytes: orphanImages.reduce((acc, i) => acc + i.bytes, 0),
        latestMtime: Math.max(...orphanImages.map((i) => i.mtime)),
      });
    }

    if (runs.length > 0) {
      stores.push({
        store,
        runs: runs.sort((a, b) => b.latestMtime - a.latestMtime),
        totalImages: runs.reduce((acc, r) => acc + r.images.length, 0),
      });
    }
  }

  return stores.sort((a, b) => a.store.localeCompare(b.store));
}

function formatRunId(runId: string): string {
  if (runId === 'legacy') return 'Legacy (avant convention runs)';
  return runId.replace(/^run-/, '').replace(/-/g, ' · ');
}

export default async function GeneratedImagesPage() {
  const stores = await listStores();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-kicker uppercase tracking-label text-zinc-400 font-medium">
          Production · GPU Pipeline
        </p>
        <h2 className="mt-1 text-3xl font-serif">
          Images <em className="italic text-zinc-700">générées</em>
        </h2>
        <p className="mt-2 text-sm text-zinc-500 max-w-2xl">
          Sortie du pipeline ComfyUI / Flux sur gpu2. Convention de stockage :{' '}
          <code className="text-xs bg-zinc-100 px-1.5 py-0.5 rounded">
            public/generated/{'{store}'}/{'{run-id}'}/
          </code>
          . Chaque tirage = un sous-dossier daté.
        </p>
      </header>

      {stores.length === 0 && (
        <div className="border border-dashed border-zinc-200 rounded-xl px-6 py-16 text-center bg-zinc-50/40">
          <p className="text-sm font-serif text-zinc-600">Aucune image générée pour le moment.</p>
        </div>
      )}

      {stores.map((s) => (
        <section key={s.store} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
          <div className="px-5 py-4 border-b border-zinc-200/60 flex items-baseline gap-3">
            <h3 className="text-base font-serif">
              Store <em className="italic text-zinc-700">{s.store}</em>
            </h3>
            <span className="text-xs uppercase tracking-wider text-zinc-400">
              · {s.runs.length} run{s.runs.length > 1 ? 's' : ''} · {s.totalImages} image
              {s.totalImages > 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-zinc-100">
            {s.runs.map((r) => (
              <div key={r.runId} className="px-5 py-4">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-mono text-xs text-zinc-700 truncate">{formatRunId(r.runId)}</span>
                    <span className="text-kicker uppercase tracking-wider text-zinc-400 shrink-0">
                      · {r.images.length} img · {(r.totalBytes / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                  <span className="text-kicker text-zinc-400 shrink-0">
                    {new Date(r.latestMtime).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {r.images.map((img) => (
                    <div
                      key={img.url}
                      className="group block border border-zinc-200 rounded-lg overflow-hidden hover:border-zinc-400 transition-colors bg-zinc-50"
                    >
                      {img.kind === 'video' ? (
                        <video
                          src={img.url}
                          controls
                          preload="metadata"
                          className="w-full aspect-[9/16] bg-black object-cover"
                        />
                      ) : img.kind === 'audio' ? (
                        <div className="aspect-square flex flex-col items-center justify-center p-4 bg-gradient-to-br from-zinc-100 to-zinc-200">
                          <span className="text-3xl mb-3">🎵</span>
                          <audio src={img.url} controls className="w-full" />
                        </div>
                      ) : (
                        <a href={img.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.filename}
                            className="w-full aspect-square object-cover bg-zinc-100"
                          />
                        </a>
                      )}
                      <div className="px-2.5 py-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-zinc-700 truncate">{img.filename}</span>
                        <span className="text-zinc-400 shrink-0 ml-2">
                          {(img.bytes / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
