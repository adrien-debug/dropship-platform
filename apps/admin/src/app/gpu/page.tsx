'use client';

import { useEffect, useState } from 'react';

interface GpuInfo {
  index: number;
  name: string;
  temperature: number;
  fanSpeed: number;
  utilization: number;
  memoryUsed: number;
  memoryTotal: number;
  powerDraw: number;
}

interface NodeStatus {
  id: string;
  name: string;
  online: boolean;
  gpus: GpuInfo[];
  cpuLoad: number[];
  ramUsedGb: number;
  ramTotalGb: number;
}

export default function GpuPage() {
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
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
    const interval = setInterval(fetchStatus, 5000);
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
        <div className="space-y-6">
          {nodes.map(node => (
            <div key={node.id} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{node.name} ({node.id})</h3>
                <span className={`h-3 w-3 rounded-full ${node.online ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {node.gpus.map(gpu => (
                  <div key={gpu.index} className="rounded-lg border p-4">
                    <p className="text-xs text-gray-500">GPU {gpu.index}</p>
                    <p className="font-medium">{gpu.name}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>VRAM</span>
                        <span>{(gpu.memoryUsed/1024).toFixed(1)}/{(gpu.memoryTotal/1024).toFixed(1)} GB</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(gpu.memoryUsed/gpu.memoryTotal)*100}%` }} />
                      </div>
                      <div className="flex justify-between">
                        <span>Temp</span>
                        <span className={gpu.temperature > 80 ? 'text-red-600 font-bold' : ''}>{gpu.temperature}C</span>
                      </div>
                      <div className="flex justify-between"><span>Power</span><span>{gpu.powerDraw}W</span></div>
                      <div className="flex justify-between"><span>Util</span><span>{gpu.utilization}%</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
