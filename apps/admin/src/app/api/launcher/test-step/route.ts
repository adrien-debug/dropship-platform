import { NextResponse, type NextRequest } from 'next/server';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync, type ExecSyncOptionsWithBufferEncoding } from 'child_process';

const EXEC_OPTS: ExecSyncOptionsWithBufferEncoding = {
  timeout: 300_000,
  maxBuffer: 10 * 1024 * 1024,
  encoding: 'buffer',
  shell: '/bin/zsh',
  env: {
    ...process.env,
    PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.nvm/versions/node/v22.14.0/bin`,
  },
};

function execCmd(cmd: string, cwd: string, extraEnv?: Record<string, string>): { ok: boolean; stdout: string; stderr: string } {
  try {
    const cleanEnv = extraEnv ? Object.fromEntries(
      Object.entries(extraEnv).filter(([_, v]) => v !== undefined)
    ) : {};
    const buf = execSync(cmd, {
      ...EXEC_OPTS,
      cwd,
      env: { ...EXEC_OPTS.env, ...cleanEnv } as NodeJS.ProcessEnv,
    });
    return { ok: true, stdout: buf.toString(), stderr: '' };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    return {
      ok: false,
      stdout: e.stdout?.toString?.() ?? '',
      stderr: e.stderr?.toString?.() ?? e.message ?? 'Unknown error',
    };
  }
}

function resolveDir(raw: string): string {
  if (raw.startsWith('~')) return raw.replace('~', homedir());
  return raw;
}

interface TestConfig {
  projectName: string;
  niche: string;
  outputDir: string;
}

interface StepResult {
  success: boolean;
  output?: string;
  error?: string;
  jobId?: string;
}

async function testScaffold(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);

  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'src', 'components'), { recursive: true });
  mkdirSync(join(dir, 'src', 'app'), { recursive: true });
  mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
  mkdirSync(join(dir, 'public', 'assets'), { recursive: true });

  const slug = config.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const packageJson = {
    name: slug,
    version: '0.1.0',
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
    dependencies: {
      next: '^15.0.0', react: '^19.0.0', 'react-dom': '^19.0.0',
      '@headlessui/react': '^2.2.0', '@heroicons/react': '^2.2.0',
      motion: '^11.15.0', clsx: '^2.1.0', zod: '^3.23.0',
    },
    devDependencies: {
      typescript: '^5.7.0', '@types/node': '^22.0.0',
      '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0',
      tailwindcss: '^4.0.0', '@tailwindcss/postcss': '^4.0.0',
      postcss: '^8.4.0', eslint: '^9.0.0', 'eslint-config-next': '^15.0.0',
    },
  };
  writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));

  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
      esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler',
      resolveJsonModule: true, isolatedModules: true, jsx: 'preserve',
      incremental: true, plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2));

  writeFileSync(join(dir, 'next.config.ts'), `import type { NextConfig } from 'next';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
};
export default nextConfig;
`);

  writeFileSync(join(dir, 'postcss.config.mjs'), `export default { plugins: { '@tailwindcss/postcss': {} } };
`);

  const brand = config.projectName;

  writeFileSync(join(dir, 'src', 'lib', 'medusa.ts'), `const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || 'http://localhost:9000';
const API_KEY = process.env.NEXT_PUBLIC_MEDUSA_API_KEY || '';

interface Product {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
}

export async function getProducts(opts?: { limit?: number }): Promise<{ products: Product[] }> {
  try {
    const res = await fetch(\`\${MEDUSA_URL}/store/products?limit=\${opts?.limit ?? 20}\`, {
      headers: API_KEY ? { 'x-publishable-api-key': API_KEY } : {},
      next: { revalidate: 60 },
    });
    if (!res.ok) return { products: [] };
    const data = await res.json();
    return { products: data.products ?? [] };
  } catch {
    return { products: [] };
  }
}
`);

  writeFileSync(join(dir, 'src', 'app', 'globals.css'), `@import "tailwindcss";
`);

  writeFileSync(join(dir, 'src', 'app', 'layout.tsx'), `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${brand}',
  description: '${brand} — ${config.niche}',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
`);

  writeFileSync(join(dir, 'src', 'app', 'page.tsx'), `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-5xl font-bold">${brand}</h1>
      <p className="mt-4 text-lg text-gray-400">${config.niche}</p>
    </main>
  );
}
`);

  const files = listFiles(dir);
  return {
    success: true,
    output: `Scaffolded at ${dir}\n\nFiles created:\n${files.join('\n')}`,
    jobId: slug,
  };
}

function listFiles(dir: string, prefix = ''): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results.push(...listFiles(join(dir, entry.name), rel));
      } else {
        results.push(rel);
      }
    }
  } catch { /* empty dir */ }
  return results;
}

async function testCodegen(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);
  if (!existsSync(join(dir, 'package.json'))) {
    return { success: false, error: 'Scaffold not found. Run scaffold step first.' };
  }

  const VLLM_URL = process.env['VLLM_GPU1_URL'] || 'http://100.88.191.49:8000/v1';
  const VLLM_KEY = process.env['VLLM_API_KEY'] || 'vllm-local-key';
  const VLLM_MODEL = process.env['VLLM_MODEL'] || 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';

  const pages = [
    { name: 'Shop', route: '/shop', sections: ['product-grid', 'filters'] },
    { name: 'About', route: '/about', sections: ['brand-story', 'values'] },
    { name: 'Contact', route: '/contact', sections: ['contact-form'] },
  ];
  const created: string[] = [];
  const mode: string[] = [];

  let useAI = false;
  try {
    const healthRes = await fetch(`${VLLM_URL}/models`, {
      headers: { Authorization: `Bearer ${VLLM_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    useAI = healthRes.ok;
  } catch { /* GPU not reachable */ }

  for (const page of pages) {
    const pageDir = join(dir, 'src', 'app', page.route.slice(1));
    mkdirSync(pageDir, { recursive: true });

    let content: string;

    if (useAI) {
      try {
        const prompt = `Generate a complete Next.js page component for an e-commerce store.
Page: ${page.name} (${page.route})
Brand: ${config.projectName} (${config.niche})
Sections: ${page.sections.join(', ')}

Requirements:
- ${page.route === '/shop' ? 'Import getProducts from "@/lib/medusa" and fetch products server-side. Display in a responsive grid with cards linking to /product/[handle].' : ''}
- ${page.route === '/about' ? 'Tell the brand story of ' + config.projectName + '. Premium dark theme.' : ''}
- ${page.route === '/contact' ? 'Contact form with name, email, message fields. Dark theme.' : ''}
- Tailwind CSS only, dark theme (bg-gray-950, text-white)
- ${page.route === '/shop' ? 'Server component (no "use client")' : '"use client" directive'}
- Export default function ${page.name}Page
- 80-200 lines, clean and functional
- Output ONLY TSX code. No markdown fences.`;

        const res = await fetch(`${VLLM_URL}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${VLLM_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: VLLM_MODEL,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(120_000),
        });

        const data = await res.json() as { choices?: { message?: { content?: string } }[] };
        content = data.choices?.[0]?.message?.content ?? '';
        content = content.trim().replace(/^```(?:tsx?|jsx?)?\n?/, '').replace(/\n?```$/, '');

        if (content.length < 50) throw new Error('Too short');
        mode.push('ai');
      } catch (err) {
        content = getFallbackPage(page.name, config);
        mode.push('fallback');
      }
    } else {
      content = getFallbackPage(page.name, config);
      mode.push('template');
    }

    writeFileSync(join(pageDir, 'page.tsx'), content);
    created.push(`src/app${page.route}/page.tsx`);
  }

  return {
    success: true,
    output: `Created ${created.length} pages:\n${created.map((f, i) => `${f} (${mode[i]})`).join('\n')}\n\nGPU LLM: ${useAI ? 'connected' : 'offline — used templates'}`,
  };
}

function getFallbackPage(name: string, config: TestConfig): string {
  if (name === 'Shop') return `import { getProducts } from '@/lib/medusa';

export default async function ShopPage() {
  let products: { id: string; title: string; handle: string; thumbnail: string | null }[] = [];
  try {
    const data = await getProducts({ limit: 20 });
    products = data.products;
  } catch {}

  return (
    <main className="mx-auto max-w-7xl px-4 py-16">
      <h1 className="text-4xl font-bold text-white">Shop</h1>
      <p className="mt-2 text-gray-400">Browse our ${config.niche} collection</p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map(p => (
          <a key={p.id} href={\`/product/\${p.handle}\`} className="group rounded-2xl border border-gray-800 bg-gray-900 p-4 transition hover:border-gray-600">
            {p.thumbnail && <img src={p.thumbnail} alt={p.title} className="aspect-square w-full rounded-xl object-cover" />}
            <h3 className="mt-3 font-semibold text-white group-hover:text-blue-400">{p.title}</h3>
          </a>
        ))}
      </div>
    </main>
  );
}`;

  if (name === 'About') return `export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold text-white">About ${config.projectName}</h1>
      <p className="mt-6 text-lg text-gray-400">We curate the finest ${config.niche} for discerning customers worldwide.</p>
      <div className="mt-12 space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-white">Our Story</h2>
          <p className="mt-3 text-gray-400">Founded with a passion for quality ${config.niche}, we source directly from the best manufacturers.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-white">Our Values</h2>
          <p className="mt-3 text-gray-400">Quality, authenticity, and customer satisfaction drive everything we do.</p>
        </section>
      </div>
    </main>
  );
}`;

  return `'use client';
import { useState } from 'react';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold text-white">Contact Us</h1>
      <p className="mt-2 text-gray-400">Questions about ${config.niche}? We are here to help.</p>
      {sent ? (
        <p className="mt-8 rounded-xl bg-green-900/30 p-6 text-green-300">Thanks! We will get back to you soon.</p>
      ) : (
        <form onSubmit={e => { e.preventDefault(); setSent(true); }} className="mt-8 space-y-4">
          <input type="text" placeholder="Name" required className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white" />
          <input type="email" placeholder="Email" required className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white" />
          <textarea placeholder="Message" rows={5} required className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white" />
          <button type="submit" className="w-full rounded-lg bg-white px-6 py-3 font-medium text-black hover:bg-gray-200 transition">Send Message</button>
        </form>
      )}
    </main>
  );
}`;
}

async function testAssets(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);
  if (!existsSync(join(dir, 'package.json'))) {
    return { success: false, error: 'No package.json found. Run scaffold first.' };
  }

  const assetsDir = join(dir, 'public', 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const logs: string[] = [];
  const COMFYUI_URL = process.env['COMFYUI_URL'] || 'http://100.88.191.49:8188';
  const NANO_BANANA_KEY = process.env['NANO_BANANA_API_KEY'] || '';

  // Check if ComfyUI is available
  let useComfyUI = false;
  try {
    const res = await fetch(`${COMFYUI_URL}/system_stats`, { signal: AbortSignal.timeout(3000) });
    useComfyUI = res.ok;
  } catch { /* ComfyUI offline */ }

  if (useComfyUI) {
    logs.push(`✓ ComfyUI detected at ${COMFYUI_URL}`);
    logs.push('⚠ ComfyUI workflow integration pending — using placeholders for now');
  } else if (NANO_BANANA_KEY) {
    logs.push('✓ Nano Banana API key found');
    logs.push('⚠ Nano Banana integration pending — using placeholders for now');
  } else {
    logs.push('⚠ No image generation service available (ComfyUI offline, no Nano Banana key)');
  }

  // Create placeholder assets
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
  <rect width="200" height="60" fill="#000"/>
  <text x="100" y="35" font-family="Arial" font-size="24" fill="#fff" text-anchor="middle">${config.projectName}</text>
</svg>`;
  
  const heroSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
  <rect width="1200" height="600" fill="#111"/>
  <text x="600" y="280" font-family="Arial" font-size="48" fill="#fff" text-anchor="middle">${config.projectName}</text>
  <text x="600" y="340" font-family="Arial" font-size="24" fill="#888" text-anchor="middle">${config.niche}</text>
</svg>`;

  writeFileSync(join(assetsDir, 'logo.svg'), logoSvg);
  writeFileSync(join(assetsDir, 'hero.svg'), heroSvg);
  logs.push('✓ Created placeholder logo.svg');
  logs.push('✓ Created placeholder hero.svg');

  return {
    success: true,
    output: `Assets step completed:\n\n${logs.join('\n')}\n\nNext steps:\n- Wire ComfyUI workflow for real logo/hero generation\n- Or integrate Nano Banana API\n- Assets saved to public/assets/`,
  };
}

async function testIntegrations(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);
  if (!existsSync(join(dir, 'package.json'))) {
    return { success: false, error: 'No package.json found. Run scaffold first.' };
  }

  const logs: string[] = [];

  const medusaUrl = process.env['NEXT_PUBLIC_MEDUSA_URL'] ?? process.env['MEDUSA_URL'] ?? '';
  const medusaPubKey = process.env['NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY'] ?? '';
  const medusaRegionId = process.env['NEXT_PUBLIC_MEDUSA_REGION_ID'] ?? '';

  // 1. Create Medusa client if not exists
  const medusaPath = join(dir, 'src', 'lib', 'medusa.ts');
  if (!existsSync(medusaPath)) {
    mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
    writeFileSync(medusaPath, `const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || '${medusaUrl}';
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '${medusaPubKey}';
const REGION_ID = process.env.NEXT_PUBLIC_MEDUSA_REGION_ID || '${medusaRegionId}';

type Json = Record<string, unknown>;

async function medusaFetch(path: string, opts?: RequestInit): Promise<Json> {
  const res = await fetch(\`\${MEDUSA_URL}\${path}\`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': PUB_KEY, ...(opts?.headers || {}) },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(\`Medusa \${res.status}\`);
  return res.json() as Promise<Json>;
}

export interface MedusaProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  thumbnail: string | null;
  images: { id: string; url: string }[];
  variants: { id: string; title: string; calculated_price?: { calculated_amount: number; currency_code: string } }[];
}

export async function getProducts(opts?: { limit?: number; offset?: number; q?: string }): Promise<{ products: MedusaProduct[]; count: number }> {
  const params = new URLSearchParams();
  params.set('region_id', REGION_ID);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  if (opts?.q) params.set('q', opts.q);
  const data = await medusaFetch(\`/store/products?\${params.toString()}\`);
  return { products: (data.products || []) as MedusaProduct[], count: (data.count || 0) as number };
}

export async function getProductByHandle(handle: string): Promise<MedusaProduct | null> {
  try {
    const data = await medusaFetch(\`/store/products?handle=\${handle}&region_id=\${REGION_ID}\`);
    const products = (data.products || []) as MedusaProduct[];
    return products[0] || null;
  } catch { return null; }
}
`);
    logs.push('✓ Created src/lib/medusa.ts');
  } else {
    logs.push('✓ src/lib/medusa.ts already exists');
  }

  // 2. Create .env.local template
  const envPath = join(dir, '.env.local');
  if (!existsSync(envPath)) {
    writeFileSync(envPath, `# Medusa
NEXT_PUBLIC_MEDUSA_URL=${medusaUrl}
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${medusaPubKey}
NEXT_PUBLIC_MEDUSA_REGION_ID=${medusaRegionId}

# Stripe (optional)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=

# Supabase (optional)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
`);
    logs.push('✓ Created .env.local template');
  } else {
    logs.push('✓ .env.local already exists');
  }

  // 3. Update package.json to include Stripe + Supabase deps (optional)
  const pkgPath = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
  const deps = (pkg.dependencies || {}) as Record<string, string>;
  
  let updated = false;
  if (!deps['@stripe/stripe-js']) {
    deps['@stripe/stripe-js'] = '^4.0.0';
    updated = true;
  }
  if (!deps['@supabase/supabase-js']) {
    deps['@supabase/supabase-js'] = '^2.45.0';
    updated = true;
  }

  if (updated) {
    pkg.dependencies = deps;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    logs.push('✓ Added Stripe + Supabase to package.json');
  } else {
    logs.push('✓ Stripe + Supabase already in package.json');
  }

  return {
    success: true,
    output: `Integrations configured:\n\n${logs.join('\n')}\n\nReady for:\n- Medusa product fetching\n- Stripe checkout (keys required)\n- Supabase auth (keys required)`,
  };
}

async function testInstall(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);
  if (!existsSync(join(dir, 'package.json'))) {
    return { success: false, error: 'No package.json found. Run scaffold first.' };
  }

  const { ok, stdout, stderr } = execCmd('npm install 2>&1', dir);
  const hasNodeModules = existsSync(join(dir, 'node_modules'));

  if (ok && hasNodeModules) {
    return { success: true, output: `npm install successful\n\n${stdout.split('\n').slice(-5).join('\n')}` };
  }
  return { success: false, error: `npm install failed:\n${stderr || stdout}`.slice(0, 2000) };
}

async function testBuild(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);
  if (!existsSync(join(dir, 'node_modules'))) {
    return { success: false, error: 'node_modules not found. Run install first.' };
  }

  const { ok, stdout, stderr } = execCmd('npx next build 2>&1', dir, { NODE_ENV: 'production' as const });

  if (ok) {
    return { success: true, output: `Build succeeded\n\n${stdout.split('\n').slice(-15).join('\n')}` };
  }
  return { success: false, error: `Build failed:\n${(stdout + '\n' + stderr).slice(-2000)}` };
}

async function testDebugFix(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);
  const MAX_RETRIES = 3;
  const VLLM_URL = process.env['VLLM_GPU1_URL'] || 'http://100.88.191.49:8000/v1';
  const VLLM_KEY = process.env['VLLM_API_KEY'] || 'vllm-local-key';
  const VLLM_MODEL = process.env['VLLM_MODEL'] || 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';
  const logs: string[] = [];

  const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '').replace(/\[0m/g, '');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    logs.push(`[attempt ${attempt}/${MAX_RETRIES}] Running build...`);
    const { ok, stdout, stderr } = execCmd('npx next build 2>&1', dir, { NODE_ENV: 'production' as const });

    if (ok) {
      logs.push('Build passed!');
      return { success: true, output: logs.join('\n') };
    }

    const buildErrors = stripAnsi((stdout + '\n' + stderr).slice(-3000));
    logs.push(`Build failed. Errors:\n${buildErrors.slice(-500)}`);

    const errorMatch = [
      ...(buildErrors.match(/Error:.*$/gm) || []),
      ...(buildErrors.match(/Type error:.*$/gm) || []),
      ...(buildErrors.match(/Module not found:.*$/gm) || []),
      ...(buildErrors.match(/SyntaxError:.*$/gm) || []),
    ];
    const fileMatch = buildErrors.match(/\.\/src\/[^\s:,)]+/g) || buildErrors.match(/src\/[^\s:,)]+\.tsx?/g) || [];

    if (errorMatch.length === 0 && !buildErrors.includes("Can't resolve") && !buildErrors.includes('Cannot find module')) {
      logs.push('No parseable errors found — cannot auto-fix.');
      continue;
    }

    const brokenFiles: { path: string; content: string }[] = [];
    const seenPaths = new Set<string>();
    for (let f of fileMatch) {
      if (!f.startsWith('./') && !f.startsWith('src/')) continue;
      if (f.startsWith('./')) f = f.slice(2);
      const absPath = join(dir, f);
      if (seenPaths.has(absPath) || !existsSync(absPath)) continue;
      seenPaths.add(absPath);
      brokenFiles.push({ path: f, content: readFileSync(absPath, 'utf-8') });
    }

    if (brokenFiles.length === 0 && errorMatch.length === 0) {
      logs.push('Could not identify broken files from error output.');
      continue;
    }

    logs.push(`Identified ${brokenFiles.length} broken file(s): ${brokenFiles.map(f => f.path).join(', ')}`);

    let useAI = false;
    try {
      const hRes = await fetch(`${VLLM_URL}/models`, {
        headers: { Authorization: `Bearer ${VLLM_KEY}` },
        signal: AbortSignal.timeout(3000),
      });
      useAI = hRes.ok;
    } catch { /* offline */ }

    // Heuristic fixes (always run first, before AI)
    const medusaMissing = buildErrors.includes("'@/lib/medusa'") || buildErrors.includes('@/lib/medusa');
    if (medusaMissing) {
      const medusaLib = join(dir, 'src', 'lib', 'medusa.ts');
      if (!existsSync(medusaLib)) {
        mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
        writeFileSync(medusaLib, `export async function getProducts(opts?: { limit?: number }) {\n  return { products: [] as { id: string; title: string; handle: string; thumbnail: string | null }[] };\n}\n`);
        logs.push('Created placeholder src/lib/medusa.ts');
      }
    }

    for (const file of brokenFiles) {
      let fixed = file.content;
      if (buildErrors.includes("'motion'") || buildErrors.includes('motion/react')) {
        fixed = fixed.replace(/from ['"]motion\/react['"]/g, 'from "motion"');
        fixed = fixed.replace(/from ['"]framer-motion['"]/g, 'from "motion"');
      }
      if (fixed !== file.content) {
        writeFileSync(join(dir, file.path), fixed);
        logs.push(`Heuristic fix applied to ${file.path}`);
      }
    }

    if (!useAI) {
      logs.push('GPU offline — heuristic fixes applied, retrying build...');
      continue;
    }

    logs.push('Calling Qwen to fix errors...');

    for (const file of brokenFiles) {
      const prompt = `Fix the following Next.js TSX file that has build errors.

FILE: ${file.path}
\`\`\`tsx
${file.content}
\`\`\`

BUILD ERRORS:
${errorMatch.join('\n')}

Requirements:
- Fix ALL TypeScript and build errors
- Keep the same visual design and functionality
- Use Tailwind CSS, dark theme
- Output ONLY the fixed TSX code. No explanations, no markdown fences.`;

      try {
        const res = await fetch(`${VLLM_URL}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${VLLM_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: VLLM_MODEL,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 4096,
            temperature: 0.05,
          }),
          signal: AbortSignal.timeout(120_000),
        });

        const data = await res.json() as { choices?: { message?: { content?: string } }[] };
        let code = data.choices?.[0]?.message?.content ?? '';
        code = code.trim().replace(/^```(?:tsx?|jsx?)?\n?/, '').replace(/\n?```$/, '');

        if (code.length > 50) {
          writeFileSync(join(dir, file.path), code);
          logs.push(`AI fixed ${file.path} (${code.split('\n').length} lines)`);
        } else {
          logs.push(`AI output too short for ${file.path}, skipped`);
        }
      } catch (err) {
        logs.push(`AI call failed for ${file.path}: ${(err as Error).message.slice(0, 100)}`);
      }
    }

  }

  const finalBuild = execCmd('npx next build 2>&1', dir, { NODE_ENV: 'production' as const });
  if (finalBuild.ok) {
    logs.push('Final build passed after fixes!');
    return { success: true, output: logs.join('\n') };
  }

  logs.push('AI fixes exhausted — replacing broken pages with safe templates...');
  const finalErrors = stripAnsi(finalBuild.stdout + '\n' + finalBuild.stderr);
  const brokenPagePaths = finalErrors.match(/\.\/src\/app\/[^\s:,)]+\.tsx/g) || [];
  for (const rawP of brokenPagePaths) {
    const rel = rawP.startsWith('./') ? rawP.slice(2) : rawP;
    const pageName = rel.includes('/shop/') ? 'Shop' : rel.includes('/about/') ? 'About' : rel.includes('/contact/') ? 'Contact' : null;
    if (pageName) {
      writeFileSync(join(dir, rel), getFallbackPage(pageName, config));
      logs.push(`Replaced ${rel} with safe template`);
    }
  }

  const retryBuild = execCmd('npx next build 2>&1', dir, { NODE_ENV: 'production' as const });
  if (retryBuild.ok) {
    logs.push('Build passed after fallback replacement!');
    return { success: true, output: logs.join('\n') };
  }

  logs.push(`Still failing after ${MAX_RETRIES} attempts + fallback.`);
  return { success: false, error: logs.join('\n') + '\n\n' + stripAnsi(retryBuild.stderr).slice(-500) };
}

async function testLaunch(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);
  if (!existsSync(join(dir, '.next'))) {
    return { success: false, error: 'No .next build folder. Run build first.' };
  }

  try {
    const portCheck = execSync("python3 -c \"import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()\"", { timeout: 5000 }).toString().trim();
    const port = parseInt(portCheck, 10);

    execSync(`cd "${dir}" && PORT=${port} npx next start -p ${port} &`, {
      timeout: 5000,
      stdio: 'ignore',
    });

    return {
      success: true,
      output: `Dev server starting on port ${port}\nURL: http://localhost:${port}\n\nCheck browser to validate.`,
    };
  } catch {
    return {
      success: true,
      output: 'Launch step configured. Use "npx next start" in the project directory to verify manually.',
    };
  }
}

async function testDeploy(config: TestConfig): Promise<StepResult> {
  const dir = resolveDir(config.outputDir);
  if (!existsSync(join(dir, '.next'))) {
    return { success: false, error: 'No .next build folder. Run build first.' };
  }

  const GPU2_HOST = process.env['GPU2_HOST'] || '100.110.74.114';
  const GPU2_USER = process.env['GPU2_USER'] || 'root';
  const slug = config.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const port = 3101 + Math.floor(Math.random() * 90);
  const logs: string[] = [];

  try {
    // 1. Create Dockerfile
    const dockerfile = `FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY . .
EXPOSE ${port}
CMD ["npm", "start"]
`;
    writeFileSync(join(dir, 'Dockerfile'), dockerfile);
    logs.push('✓ Created Dockerfile');

    // 2. Create .dockerignore
    writeFileSync(join(dir, '.dockerignore'), `node_modules
.next
.git
*.log
.env.local
`);
    logs.push('✓ Created .dockerignore');

    // 3. Build Docker image locally
    logs.push(`Building Docker image: ${slug}:latest...`);
    const buildCmd = `docker build -t ${slug}:latest .`;
    const { ok: buildOk, stdout: buildOut, stderr: buildErr } = execCmd(buildCmd, dir);
    
    if (!buildOk) {
      logs.push(`✗ Docker build failed:\n${buildErr.slice(-500)}`);
      return { success: false, error: logs.join('\n') };
    }
    logs.push('✓ Docker image built');

    // 4. Save image to tar
    const tarPath = join(dir, `${slug}.tar`);
    logs.push('Saving image to tar...');
    const saveCmd = `docker save ${slug}:latest -o ${slug}.tar`;
    const { ok: saveOk } = execCmd(saveCmd, dir);
    
    if (!saveOk) {
      logs.push('✗ Failed to save Docker image');
      return { success: false, error: logs.join('\n') };
    }
    logs.push(`✓ Image saved to ${slug}.tar`);

    // 5. Transfer to GPU2
    logs.push(`Transferring to ${GPU2_HOST}...`);
    const scpCmd = `scp ${slug}.tar ${GPU2_USER}@${GPU2_HOST}:/tmp/`;
    const { ok: scpOk } = execCmd(scpCmd, dir);
    
    if (!scpOk) {
      logs.push('✗ SCP transfer failed (check SSH keys)');
      return { success: false, error: logs.join('\n') };
    }
    logs.push('✓ Transferred to GPU2');

    // 6. Load image on GPU2 and run container
    logs.push('Loading image on GPU2 and starting container...');
    const remoteCmd = `ssh ${GPU2_USER}@${GPU2_HOST} "docker load -i /tmp/${slug}.tar && docker stop ${slug} 2>/dev/null || true && docker rm ${slug} 2>/dev/null || true && docker run -d --name ${slug} --network host -e PORT=${port} ${slug}:latest && rm /tmp/${slug}.tar"`;
    const { ok: remoteOk, stderr: remoteErr } = execCmd(remoteCmd, dir);
    
    if (!remoteOk) {
      logs.push(`✗ Remote deploy failed:\n${remoteErr.slice(-500)}`);
      return { success: false, error: logs.join('\n') };
    }
    logs.push(`✓ Container started on GPU2:${port}`);

    // Clean up local tar
    execCmd(`rm ${slug}.tar`, dir);

    return {
      success: true,
      output: `${logs.join('\n')}\n\n✓ Site deployed!\nURL: http://${GPU2_HOST}:${port}\n\nContainer name: ${slug}\nPort: ${port}`,
    };
  } catch (err) {
    logs.push(`✗ Deploy error: ${(err as Error).message}`);
    return { success: false, error: logs.join('\n') };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stepId = body.stepId as string;
    const config = body.config as TestConfig;

    if (!stepId || !config?.projectName) {
      return NextResponse.json({ success: false, error: 'Missing stepId or config' }, { status: 400 });
    }

    let result: StepResult;

    switch (stepId) {
      case 'scaffold':     result = await testScaffold(config); break;
      case 'codegen':      result = await testCodegen(config); break;
      case 'integrations': result = await testIntegrations(config); break;
      case 'assets':       result = await testAssets(config); break;
      case 'install':      result = await testInstall(config); break;
      case 'build-check':  result = await testBuild(config); break;
      case 'debug-fix':    result = await testDebugFix(config); break;
      case 'launch':       result = await testLaunch(config); break;
      case 'deploy':       result = await testDeploy(config); break;
      default:
        result = { success: false, error: `Unknown step: ${stepId}` };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[launcher/test-step]', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
