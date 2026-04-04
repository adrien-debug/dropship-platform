'use client';

import { useEffect, useState } from 'react';

interface ModelInfo {
  id: string;
  port: number;
  status: 'up' | 'down';
}

interface NodeInfo {
  name: string;
  host: string;
  status: string;
  models?: ModelInfo[];
  services?: string[];
}

export default function GpuPage() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/gpu-status');
        const data = await res.json();
        setNodes(data.nodes ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">GPU Infrastructure</h2>
      {loading ? (
        <div className="h-60 animate-pulse rounded-xl bg-gray-100" />
      ) : nodes.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
          Impossible de se connecter aux serveurs GPU. Verifiez la connexion Tailscale.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {nodes.map(node => (
            <div key={node.name} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{node.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{node.host}</p>
                </div>
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  node.status === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${node.status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {node.status === 'up' ? 'Online' : 'Offline'}
                </span>
              </div>

              {node.models && node.models.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Modeles vLLM</h4>
                  {node.models.map(model => (
                    <div key={model.port} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{model.id}</p>
                        <p className="text-xs text-gray-500">Port {model.port}</p>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${model.status === 'up' ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                  ))}
                </div>
              )}

              {node.services && node.services.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Services</h4>
                  <div className="flex flex-wrap gap-2">
                    {node.services.map(svc => (
                      <span key={svc} className="rounded-lg border bg-gray-50 px-3 py-1.5 text-xs font-medium">
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
