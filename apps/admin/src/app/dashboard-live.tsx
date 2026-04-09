'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DashboardLive() {
  const router = useRouter();
  const [niche, setNiche] = useState('');
  const [creating, setCreating] = useState(false);

  const quickCreate = async () => {
    if (!niche.trim()) return;
    setCreating(true);
    router.push(`/agents?niche=${encodeURIComponent(niche.trim())}`);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2">
        <input
          type="text"
          value={niche}
          onChange={e => setNiche(e.target.value)}
          placeholder="Niche → site rapide..."
          className="w-44 bg-transparent text-sm outline-none placeholder:text-gray-400"
          onKeyDown={e => { if (e.key === 'Enter') quickCreate(); }}
        />
        <button
          onClick={quickCreate}
          disabled={creating || !niche.trim()}
          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? '...' : '⚡ Go'}
        </button>
      </div>
      <button
        onClick={() => router.refresh()}
        className="rounded-lg border px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
        title="Rafraichir"
      >
        🔄
      </button>
    </div>
  );
}
