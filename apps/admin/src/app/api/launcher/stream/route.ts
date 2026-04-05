import { type NextRequest } from 'next/server';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

function resolveDir(raw: string): string {
  if (raw.startsWith('~')) return raw.replace('~', homedir());
  return raw;
}

function emit(controller: ReadableStreamDefaultController, step: string, status: string, detail: string) {
  const data = JSON.stringify({ step, status, detail, ts: Date.now() });
  controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
}

function listFiles(dir: string, prefix = ''): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) results.push(...listFiles(join(dir, entry.name), rel));
      else results.push(rel);
    }
  } catch { /* */ }
  return results;
}

const EXEC_ENV = {
  ...process.env,
  PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.nvm/versions/node/v22.14.0/bin`,
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = body.config as { projectName: string; niche: string; outputDir: string };
  const dir = resolveDir(config.outputDir);
  const brand = config.projectName;
  const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const VLLM_URL = process.env['VLLM_GPU1_URL'] || 'http://100.88.191.49:8000/v1';
  const VLLM_KEY = process.env['VLLM_API_KEY'] || 'vllm-local-key';
  const VLLM_MODEL = process.env['VLLM_MODEL'] || 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Scaffold
        emit(controller, 'scaffold', 'running', 'Creating project directory...');
        mkdirSync(dir, { recursive: true });
        mkdirSync(join(dir, 'src', 'components'), { recursive: true });
        mkdirSync(join(dir, 'src', 'app'), { recursive: true });
        mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
        mkdirSync(join(dir, 'public', 'assets'), { recursive: true });

        writeFileSync(join(dir, 'package.json'), JSON.stringify({
          name: slug, version: '0.1.0', private: true,
          scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
          dependencies: { next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0', clsx: '^2.1.0' },
          devDependencies: {
            typescript: '^5.7.0', '@types/node': '^22.0.0', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0',
            tailwindcss: '^4.0.0', '@tailwindcss/postcss': '^4.0.0', postcss: '^8.4.0',
            eslint: '^9.0.0', 'eslint-config-next': '^15.0.0',
          },
        }, null, 2));

        writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
          compilerOptions: {
            target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'], allowJs: true, skipLibCheck: true,
            strict: true, noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler',
            resolveJsonModule: true, isolatedModules: true, jsx: 'preserve', incremental: true,
            plugins: [{ name: 'next' }], paths: { '@/*': ['./src/*'] },
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'],
        }, null, 2));

        writeFileSync(join(dir, 'next.config.ts'), `import type { NextConfig } from 'next';\nimport { dirname } from 'path';\nimport { fileURLToPath } from 'url';\nconst __dirname = dirname(fileURLToPath(import.meta.url));\nconst nextConfig: NextConfig = { reactStrictMode: true, outputFileTracingRoot: __dirname };\nexport default nextConfig;\n`);
        writeFileSync(join(dir, 'postcss.config.mjs'), `export default { plugins: { '@tailwindcss/postcss': {} } };\n`);
        writeFileSync(join(dir, 'src', 'app', 'globals.css'), `@import "tailwindcss";\n`);
        writeFileSync(join(dir, 'src', 'app', 'layout.tsx'), `import type { Metadata } from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = { title: '${brand}', description: '${brand} — ${config.niche}' };\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang="en"><body className="min-h-screen bg-gray-950 text-white antialiased">{children}</body></html>;\n}\n`);
        writeFileSync(join(dir, 'src', 'app', 'page.tsx'), `export default function Home() {\n  return <main className="flex min-h-screen flex-col items-center justify-center"><h1 className="text-5xl font-bold">${brand}</h1><p className="mt-4 text-lg text-gray-400">${config.niche}</p></main>;\n}\n`);

        const files = listFiles(dir);
        emit(controller, 'scaffold', 'done', `${files.length} files created at ${dir}`);

        // Step 2: Codegen — check GPU
        emit(controller, 'codegen', 'running', 'Checking GPU1 LLM availability...');
        let useAI = false;
        try {
          const hRes = await fetch(`${VLLM_URL}/models`, {
            headers: { Authorization: `Bearer ${VLLM_KEY}` },
            signal: AbortSignal.timeout(5000),
          });
          useAI = hRes.ok;
        } catch { /* */ }

        emit(controller, 'codegen', 'running', useAI ? `GPU1 connected (${VLLM_MODEL})` : 'GPU offline — using templates');

        const pages = [
          { name: 'Shop', route: '/shop' },
          { name: 'About', route: '/about' },
          { name: 'Contact', route: '/contact' },
        ];

        for (const page of pages) {
          const pageDir = join(dir, 'src', 'app', page.route.slice(1));
          mkdirSync(pageDir, { recursive: true });

          emit(controller, 'codegen', 'running', `Generating ${page.name} page${useAI ? ' with AI...' : '...'}`);

          let code: string;

          if (useAI) {
            try {
              const prompt = `Generate a complete Next.js page for an e-commerce store.
Page: ${page.name} (${page.route})
Brand: ${brand} (${config.niche})
Requirements:
- ${page.route === '/shop' ? 'Server component. Import getProducts from "@/lib/medusa". Fetch products server-side. Display in responsive grid. Cards link to /product/[handle].' : ''}
- ${page.route === '/about' ? '"use client". Brand story for ' + brand + '. Premium dark theme bg-gray-950.' : ''}
- ${page.route === '/contact' ? '"use client" with useState. Contact form: name, email, message. Dark theme.' : ''}
- Tailwind CSS, dark theme (bg-gray-950, text-white)
- Export default function ${page.name}Page
- 80-200 lines. Output ONLY TSX. No markdown.`;

              emit(controller, 'codegen', 'running', `${page.name}: calling Qwen2.5-Coder-32B...`);
              const t0 = Date.now();

              const res = await fetch(`${VLLM_URL}/chat/completions`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${VLLM_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: VLLM_MODEL,
                  messages: [{ role: 'user', content: prompt }],
                  max_tokens: 8000, temperature: 0.1,
                }),
                signal: AbortSignal.timeout(120_000),
              });

              const data = await res.json() as { choices?: { message?: { content?: string } }[] };
              code = data.choices?.[0]?.message?.content ?? '';
              code = code.trim().replace(/^```(?:tsx?|jsx?)?\n?/, '').replace(/\n?```$/, '');

              const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

              if (code.length < 50) {
                emit(controller, 'codegen', 'running', `${page.name}: AI output too short (${code.length} chars), using template`);
                code = getFallback(page.name, config);
              } else {
                emit(controller, 'codegen', 'running', `${page.name}: AI generated ${code.length} chars in ${elapsed}s`);
              }
            } catch (err) {
              emit(controller, 'codegen', 'running', `${page.name}: AI failed (${(err as Error).message.slice(0, 100)}), using template`);
              code = getFallback(page.name, config);
            }
          } else {
            code = getFallback(page.name, config);
          }

          writeFileSync(join(pageDir, 'page.tsx'), code);
          emit(controller, 'codegen', 'running', `${page.name}: written to src/app${page.route}/page.tsx (${code.split('\n').length} lines)`);
        }

        emit(controller, 'codegen', 'done', `3 pages generated`);

        // Step 3: Install
        emit(controller, 'install', 'running', 'Running npm install...');
        try {
          execSync('npm install 2>&1', {
            cwd: dir, timeout: 180_000, maxBuffer: 10 * 1024 * 1024,
            shell: '/bin/zsh', env: EXEC_ENV,
          });
          emit(controller, 'install', 'done', 'Dependencies installed');
        } catch (err) {
          emit(controller, 'install', 'error', `npm install failed: ${(err as Error).message.slice(0, 200)}`);
          emit(controller, 'pipeline', 'error', 'Pipeline stopped at install');
          controller.close();
          return;
        }

        // Step 4: Build
        emit(controller, 'build', 'running', 'Running next build...');
        try {
          const out = execSync('npx next build 2>&1', {
            cwd: dir, timeout: 300_000, maxBuffer: 10 * 1024 * 1024,
            shell: '/bin/zsh', env: { ...EXEC_ENV, NODE_ENV: 'production' },
          }).toString();
          const routes = out.match(/Route \(app\)[\s\S]*?○\s+\(Static\)/)?.[0] ?? '';
          emit(controller, 'build', 'done', routes || 'Build succeeded');
        } catch (err) {
          const e = err as { stdout?: Buffer; stderr?: Buffer };
          const msg = (e.stdout?.toString?.() ?? '') + '\n' + (e.stderr?.toString?.() ?? '');
          emit(controller, 'build', 'error', `Build failed:\n${msg.slice(-500)}`);
          emit(controller, 'pipeline', 'error', 'Pipeline stopped at build');
          controller.close();
          return;
        }

        // Done
        emit(controller, 'pipeline', 'done', `Site ready at ${dir}`);
      } catch (err) {
        emit(controller, 'pipeline', 'error', (err as Error).message);
      }

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

function getFallback(name: string, config: { projectName: string; niche: string }): string {
  if (name === 'Shop') return `import { getProducts } from '@/lib/medusa';\n\nexport default async function ShopPage() {\n  let products: { id: string; title: string; handle: string; thumbnail: string | null }[] = [];\n  try { const d = await getProducts({ limit: 20 }); products = d.products; } catch {}\n  return (\n    <main className="mx-auto max-w-7xl px-4 py-16">\n      <h1 className="text-4xl font-bold text-white">Shop</h1>\n      <p className="mt-2 text-gray-400">Browse our ${config.niche} collection</p>\n      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">\n        {products.map(p => (\n          <a key={p.id} href={\\"/product/\\" + p.handle} className="group rounded-2xl border border-gray-800 bg-gray-900 p-4 transition hover:border-gray-600">\n            {p.thumbnail && <img src={p.thumbnail} alt={p.title} className="aspect-square w-full rounded-xl object-cover" />}\n            <h3 className="mt-3 font-semibold text-white group-hover:text-blue-400">{p.title}</h3>\n          </a>\n        ))}\n      </div>\n    </main>\n  );\n}`;
  if (name === 'About') return `export default function AboutPage() {\n  return (\n    <main className="mx-auto max-w-3xl px-4 py-16">\n      <h1 className="text-4xl font-bold text-white">About ${config.projectName}</h1>\n      <p className="mt-6 text-lg text-gray-400">We curate the finest ${config.niche} for discerning customers.</p>\n    </main>\n  );\n}`;
  return `'use client';\nimport { useState } from 'react';\n\nexport default function ContactPage() {\n  const [sent, setSent] = useState(false);\n  return (\n    <main className="mx-auto max-w-xl px-4 py-16">\n      <h1 className="text-3xl font-bold text-white">Contact Us</h1>\n      {sent ? <p className="mt-8 rounded-xl bg-green-900/30 p-6 text-green-300">Thanks!</p> : (\n        <form onSubmit={e => { e.preventDefault(); setSent(true); }} className="mt-8 space-y-4">\n          <input type="text" placeholder="Name" required className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white" />\n          <input type="email" placeholder="Email" required className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white" />\n          <textarea placeholder="Message" rows={5} required className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white" />\n          <button type="submit" className="w-full rounded-lg bg-white px-6 py-3 font-medium text-black">Send</button>\n        </form>\n      )}\n    </main>\n  );\n}`;
}
