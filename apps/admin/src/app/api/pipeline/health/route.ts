import { type NextRequest } from 'next/server';

interface ServiceDef {
  id: string;
  label: string;
  category: 'commerce' | 'ai' | 'infra' | 'deploy' | 'suppliers';
  check: () => Promise<{ ok: boolean; latency: number; detail: string }>;
}

const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const SUPABASE_URL = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';
const VLLM_GPU1_URL = process.env['VLLM_GPU1_URL'] ?? 'http://100.88.191.49:8000/v1';
const VLLM_GPU1_FAST_URL = process.env['VLLM_GPU1_FAST_URL'] ?? 'http://100.88.191.49:8001/v1';
const COMFYUI_URL = process.env['COMFYUI_URL'] ?? 'http://100.88.191.49:8188';
const GPU1_BACKEND_URL = process.env['GPU1_BACKEND_URL'] ?? 'http://100.88.191.49:3848';
const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const CJ_API_KEY = process.env['CJ_DROPSHIPPING_API_KEY'] ?? '';
const ALIEXPRESS_APP_KEY = process.env['ALIEXPRESS_APP_KEY'] ?? '';
const ALIEXPRESS_APP_SECRET = process.env['ALIEXPRESS_APP_SECRET'] ?? '';
const OPENCLAW_URL = process.env['OPENCLAW_URL'] ?? `http://${GPU2_HOST}:3849`;

async function httpCheck(url: string, timeoutMs = 8000): Promise<{ ok: boolean; latency: number; detail: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    const latency = Date.now() - start;
    if (res.ok || res.status < 500) {
      return { ok: true, latency, detail: `${res.status} (${latency}ms)` };
    }
    return { ok: false, latency, detail: `HTTP ${res.status}` };
  } catch (err) {
    const latency = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const short = msg.includes('timeout') ? 'Timeout' : msg.includes('ECONNREFUSED') ? 'Connection refused' : msg.slice(0, 80);
    return { ok: false, latency, detail: short };
  }
}

function buildServices(): ServiceDef[] {
  return [
    {
      id: 'medusa',
      label: 'Medusa',
      category: 'commerce',
      check: () => httpCheck(`${MEDUSA_URL}/health`),
    },
    {
      id: 'supabase',
      label: 'Supabase',
      category: 'commerce',
      check: async () => {
        if (!SUPABASE_URL) return { ok: false, latency: 0, detail: 'URL not configured' };
        const start = Date.now();
        try {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
            signal: AbortSignal.timeout(8000),
            cache: 'no-store',
          });
          const latency = Date.now() - start;
          return { ok: res.ok || res.status < 500, latency, detail: `${res.status} (${latency}ms)` };
        } catch (err) {
          return { ok: false, latency: Date.now() - start, detail: err instanceof Error ? err.message.slice(0, 80) : 'Error' };
        }
      },
    },
    {
      id: 'vllm-gpu1',
      label: 'vLLM GPU1',
      category: 'ai',
      check: () => httpCheck(`${VLLM_GPU1_URL}/models`),
    },
    {
      id: 'vllm-gpu1-fast',
      label: 'vLLM GPU1 Fast',
      category: 'ai',
      check: () => httpCheck(`${VLLM_GPU1_FAST_URL}/models`),
    },
    {
      id: 'comfyui',
      label: 'ComfyUI',
      category: 'ai',
      check: () => httpCheck(`${COMFYUI_URL}/system_stats`),
    },
    {
      id: 'gpu1-backend',
      label: 'GPU1 Backend',
      category: 'infra',
      check: () => httpCheck(`${GPU1_BACKEND_URL}/health`),
    },
    {
      id: 'gpu2-medusa-admin',
      label: 'Medusa Admin UI',
      category: 'deploy',
      check: () => httpCheck(`${MEDUSA_URL}/app`),
    },
    {
      id: 'gpu2-ssh',
      label: 'GPU2 SSH',
      category: 'deploy',
      check: async () => {
        const start = Date.now();
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          const sshUser = process.env['GPU_SSH_USER'] ?? 'comput3';
          await execAsync(
            `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes ${sshUser}@${GPU2_HOST} echo ok`,
            { timeout: 10_000 },
          );
          return { ok: true, latency: Date.now() - start, detail: `Connected (${Date.now() - start}ms)` };
        } catch (err) {
          return { ok: false, latency: Date.now() - start, detail: err instanceof Error ? err.message.slice(0, 80) : 'SSH failed' };
        }
      },
    },
    {
      id: 'openclaw',
      label: 'OpenClaw API',
      category: 'ai',
      check: () => httpCheck(`${OPENCLAW_URL}/health`),
    },
    {
      id: 'cj-dropshipping',
      label: 'CJ Dropshipping',
      category: 'suppliers',
      check: async () => {
        if (!CJ_API_KEY) return { ok: false, latency: 0, detail: 'API key not configured' };
        const start = Date.now();
        try {
          const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: CJ_API_KEY }),
            signal: AbortSignal.timeout(8000),
          });
          const json = await res.json() as { code?: number; result?: boolean; message?: string };
          const latency = Date.now() - start;
          if (json.result && json.code === 200) {
            return { ok: true, latency, detail: `Auth OK (${latency}ms)` };
          }
          return { ok: false, latency, detail: json.message ?? `Code ${json.code}` };
        } catch (err) {
          return { ok: false, latency: Date.now() - start, detail: err instanceof Error ? err.message.slice(0, 80) : 'Error' };
        }
      },
    },
    {
      id: 'aliexpress',
      label: 'AliExpress',
      category: 'suppliers',
      check: async () => {
        if (!ALIEXPRESS_APP_KEY || !ALIEXPRESS_APP_SECRET) {
          return { ok: false, latency: 0, detail: 'API key not configured' };
        }
        const start = Date.now();
        try {
          const { createHmac } = await import('crypto');
          const d = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          const method = 'aliexpress.affiliate.product.query';
          const params: Record<string, string> = {
            method,
            app_key: ALIEXPRESS_APP_KEY,
            sign_method: 'hmac-sha256',
            timestamp: ts,
            v: '2.0',
            format: 'json',
            simplify: 'true',
            keywords: 'test',
            target_currency: 'EUR',
            target_language: 'EN',
            page_no: '1',
            page_size: '1',
          };
          const apiPath = '/' + method.replace(/\./g, '/');
          const sorted = Object.keys(params).sort();
          const baseString = apiPath + sorted.map(k => k + params[k]!).join('');
          params['sign'] = createHmac('sha256', ALIEXPRESS_APP_SECRET).update(baseString).digest('hex').toUpperCase();
          const qs = new URLSearchParams(params).toString();
          const res = await fetch(`https://api-sg.aliexpress.com/sync?${qs}`, {
            method: 'POST',
            signal: AbortSignal.timeout(10000),
          });
          const latency = Date.now() - start;
          return { ok: res.ok, latency, detail: `${res.status} (${latency}ms)` };
        } catch (err) {
          return { ok: false, latency: Date.now() - start, detail: err instanceof Error ? err.message.slice(0, 80) : 'Error' };
        }
      },
    },
    {
      id: 'redis',
      label: 'Redis',
      category: 'infra',
      check: async () => {
        const start = Date.now();
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          const { stdout } = await execAsync('redis-cli ping', { timeout: 5000 });
          const ok = stdout.trim() === 'PONG';
          return { ok, latency: Date.now() - start, detail: ok ? `PONG (${Date.now() - start}ms)` : stdout.trim() };
        } catch {
          return { ok: false, latency: Date.now() - start, detail: 'Not reachable' };
        }
      },
    },
    {
      id: 'postgres',
      label: 'PostgreSQL',
      category: 'infra',
      check: async () => {
        const start = Date.now();
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          const { stdout } = await execAsync('pg_isready -h localhost -p 5432', { timeout: 5000 });
          const ok = stdout.includes('accepting connections');
          return { ok, latency: Date.now() - start, detail: ok ? `Ready (${Date.now() - start}ms)` : stdout.trim() };
        } catch {
          return { ok: false, latency: Date.now() - start, detail: 'Not reachable' };
        }
      },
    },
  ];
}

function emit(
  controller: ReadableStreamDefaultController,
  data: Record<string, unknown>,
) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

export async function POST(_req: NextRequest) {
  const services = buildServices();

  const stream = new ReadableStream({
    async start(controller) {
      const results: { id: string; ok: boolean }[] = [];

      for (const svc of services) {
        emit(controller, { id: svc.id, label: svc.label, category: svc.category, status: 'checking' });

        const result = await svc.check();
        results.push({ id: svc.id, ok: result.ok });

        emit(controller, {
          id: svc.id,
          label: svc.label,
          category: svc.category,
          status: result.ok ? 'online' : 'offline',
          latency: result.latency,
          detail: result.detail,
        });
      }

      const online = results.filter(r => r.ok).length;
      emit(controller, {
        done: true,
        summary: { online, offline: results.length - online, total: results.length },
        ready: online === results.length,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
