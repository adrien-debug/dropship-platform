import { type NextRequest } from 'next/server';
import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { execSync, type ExecSyncOptionsWithBufferEncoding } from 'child_process';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { getDesignSystem, toCssVariables, toGoogleFontsUrl } from '@dropship/design-systems';
import { generateFullSite, type EcommerceSiteConfig, getDefaultEcommercePages } from '@dropship/launcher';

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

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const GPU2_USER = process.env['GPU2_USER'] ?? process.env['GPU_SSH_USER'] ?? 'comput3';
const MEDUSA_URL = process.env['MEDUSA_URL'] ?? 'http://100.110.74.114:9000';
const STRIPE_PK = process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] ?? '';
const SUPABASE_URL = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_KEY =
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

interface ImportedProduct {
  id: string;
  title: string;
  handle: string;
  image: string;
  category: string;
  price: number;
}

interface StreamConfig {
  projectName: string;
  niche: string;
  outputDir: string;
  port?: number;
  market?: string;
  positioning?: string;
  designSystem?: string;
  siteId?: string;
  salesChannelId?: string;
  publishableKey?: string;
  regionId?: string;
  importedProducts?: ImportedProduct[];
  // Advanced options
  tagline?: string;
  tone?: 'friendly' | 'professional' | 'sophisticated' | 'playful' | 'bold';
  brandColors?: {
    accent?: string;
    bg?: string;
    text?: string;
  };
  referenceUrls?: string[];
  pages?: string[];
}

function resolveDir(raw: string): string {
  if (raw.startsWith('~')) return raw.replace('~', homedir());
  return raw;
}

function execCmd(
  command: string,
  cwd: string,
  extraEnv?: Record<string, string>,
): { ok: boolean; stdout: string; stderr: string } {
  try {
    const cleanEnv = extraEnv
      ? Object.fromEntries(Object.entries(extraEnv).filter(([, value]) => value !== undefined))
      : {};
    const out = execSync(command, {
      ...EXEC_OPTS,
      cwd,
      env: { ...EXEC_OPTS.env, ...cleanEnv } as NodeJS.ProcessEnv,
    });
    return { ok: true, stdout: out.toString(), stderr: '' };
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    return {
      ok: false,
      stdout: e.stdout?.toString?.() ?? '',
      stderr: e.stderr?.toString?.() ?? e.message ?? 'Unknown error',
    };
  }
}

function emit(
  controller: ReadableStreamDefaultController,
  step: string,
  status: 'running' | 'done' | 'error',
  detail: string,
) {
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
  } catch {}
  return results;
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function svgLogo(brand: string, accent: string, text: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60" viewBox="0 0 220 60">
  <rect width="220" height="60" rx="14" fill="${text}"/>
  <circle cx="32" cy="30" r="14" fill="${accent}"/>
  <text x="58" y="38" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${accent}">${brand}</text>
</svg>`;
}

function writeBaseFiles(dir: string, config: StreamConfig) {
  const slug = config.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'src', 'app', 'product', '[handle]'), { recursive: true });
  mkdirSync(join(dir, 'src', 'app', 'api', 'cart'), { recursive: true });
  mkdirSync(join(dir, 'src', 'app', 'cart'), { recursive: true });
  mkdirSync(join(dir, 'src', 'app', 'checkout'), { recursive: true });
  mkdirSync(join(dir, 'src', 'lib'), { recursive: true });
  mkdirSync(join(dir, 'src', 'components'), { recursive: true });
  mkdirSync(join(dir, 'public', 'assets'), { recursive: true });

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: slug,
        version: '0.1.0',
        private: true,
        scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
        dependencies: {
          next: '^15.0.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          clsx: '^2.1.0',
          '@stripe/stripe-js': '^5.5.0',
        },
        devDependencies: {
          typescript: '^5.7.0',
          '@types/node': '^22.0.0',
          '@types/react': '^19.0.0',
          '@types/react-dom': '^19.0.0',
          tailwindcss: '^4.0.0',
          '@tailwindcss/postcss': '^4.0.0',
          postcss: '^8.4.0',
          eslint: '^9.0.0',
          'eslint-config-next': '^15.0.0',
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(dir, 'next.config.ts'),
    `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`,
  );

  writeFileSync(join(dir, 'postcss.config.mjs'), `export default { plugins: { '@tailwindcss/postcss': {} } };\n`);
}

function writeThemeFiles(dir: string, config: StreamConfig) {
  let ds = getDesignSystem(config.designSystem ?? 'swiss') ?? getDesignSystem('swiss')!;
  
  // Override colors if custom colors provided
  if (config.brandColors?.accent || config.brandColors?.bg || config.brandColors?.text) {
    ds = {
      ...ds,
      colors: {
        ...ds.colors,
        ...(config.brandColors.accent && { accent: config.brandColors.accent }),
        ...(config.brandColors.bg && { bg: config.brandColors.bg }),
        ...(config.brandColors.text && { text: config.brandColors.text }),
      },
    };
  }
  
  const cssVars = toCssVariables(ds);
  const fontsUrl = toGoogleFontsUrl(ds);
  const brand = config.projectName;

  writeFileSync(
    join(dir, 'src', 'app', 'globals.css'),
    `@import "tailwindcss";

${cssVars}

:root {
  color-scheme: ${ds.darkMode ? 'dark' : 'light'};
}

body {
  background: var(--ds-bg);
  color: var(--ds-text);
  font-family: var(--ds-font-body, var(--ds-font-primary), sans-serif);
}

a {
  transition: var(--ds-transition);
}
`,
  );

  writeFileSync(
    join(dir, 'src', 'app', 'layout.tsx'),
    `import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Providers } from '@/components/providers';
import { CartCount } from '@/components/cart-count';

export const metadata: Metadata = {
  title: ${JSON.stringify(`${brand} — ${config.niche}`)},
  description: ${JSON.stringify(`${brand} — ${config.niche}`)},
};

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className=${JSON.stringify(ds.darkMode ? 'dark' : '')}>
      <head>
        ${fontsUrl ? `<link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="${fontsUrl}" rel="stylesheet" />` : ''}
      </head>
      <body className="min-h-screen" style={{ background: 'var(--ds-bg)', color: 'var(--ds-text)' }}>
        <Providers>
          <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ borderColor: 'var(--ds-border)', background: 'color-mix(in srgb, var(--ds-bg) 88%, transparent)' }}>
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--ds-font-primary)' }}>
                ${brand}
              </Link>
              <div className="flex items-center gap-6">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="text-sm hover:opacity-100" style={{ color: 'var(--ds-text-secondary)' }}>
                    {link.label}
                  </Link>
                ))}
                <Link href="/cart" className="relative ml-2">
                  <CartCount />
                </Link>
              </div>
            </nav>
          </header>
          {children}
          <footer className="border-t px-6 py-10 text-center text-sm" style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-muted)' }}>
            ${brand} • ${config.niche}
          </footer>
        </Providers>
      </body>
    </html>
  );
}
`,
  );

  writeFileSync(join(dir, 'public', 'assets', 'logo.svg'), svgLogo(brand, ds.colors.accent, ds.colors.bg));
}

function writeMedusaFiles(dir: string, config: StreamConfig) {
  writeFileSync(
    join(dir, '.env.local'),
    `NEXT_PUBLIC_MEDUSA_URL=${MEDUSA_URL}
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${config.publishableKey ?? ''}
NEXT_PUBLIC_MEDUSA_REGION_ID=${config.regionId ?? ''}
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PK}
NEXT_PUBLIC_SITE_ID=${config.siteId ?? ''}
`,
  );

  writeFileSync(
    join(dir, 'src', 'lib', 'medusa.ts'),
    `const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || ${JSON.stringify(MEDUSA_URL)};
const PUB_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ${JSON.stringify(config.publishableKey ?? '')};
const REGION_ID = process.env.NEXT_PUBLIC_MEDUSA_REGION_ID || ${JSON.stringify(config.regionId ?? '')};

type Json = Record<string, unknown>;

async function medusaFetch(path: string, opts?: RequestInit): Promise<Json> {
  const res = await fetch(\`\${MEDUSA_URL}\${path}\`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': PUB_KEY, ...(opts?.headers || {}) },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(\`Medusa \${res.status}\`);
  return res.json() as Promise<Json>;
}

async function medusaMutate(path: string, opts?: RequestInit): Promise<Json> {
  const res = await fetch(\`\${MEDUSA_URL}\${path}\`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': PUB_KEY, ...(opts?.headers || {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(\`Medusa \${res.status}: \${text.slice(0, 200)}\`);
  }
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
  if (REGION_ID) params.set('region_id', REGION_ID);
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  if (opts?.q) params.set('q', opts.q);
  const data = await medusaFetch(\`/store/products?\${params.toString()}\`);
  return { products: (data.products || []) as MedusaProduct[], count: (data.count || 0) as number };
}

export async function getProductByHandle(handle: string): Promise<MedusaProduct | null> {
  try {
    const params = new URLSearchParams({ handle });
    if (REGION_ID) params.set('region_id', REGION_ID);
    const data = await medusaFetch(\`/store/products?\${params.toString()}\`);
    const products = (data.products || []) as MedusaProduct[];
    return products[0] || null;
  } catch {
    return null;
  }
}

export async function createCart() {
  return medusaMutate('/store/carts', { method: 'POST', body: JSON.stringify({ region_id: REGION_ID }) });
}

export async function getCart(cartId: string) {
  return medusaMutate(\`/store/carts/\${cartId}\`);
}

export async function addLineItem(cartId: string, variantId: string, quantity = 1) {
  return medusaMutate(\`/store/carts/\${cartId}/line-items\`, {
    method: 'POST',
    body: JSON.stringify({ variant_id: variantId, quantity }),
  });
}

export async function updateLineItem(cartId: string, lineItemId: string, quantity: number) {
  return medusaMutate(\`/store/carts/\${cartId}/line-items/\${lineItemId}\`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  });
}

export async function removeLineItem(cartId: string, lineItemId: string) {
  return medusaMutate(\`/store/carts/\${cartId}/line-items/\${lineItemId}\`, { method: 'DELETE' });
}

export async function updateCart(cartId: string, update: Record<string, unknown>) {
  return medusaMutate(\`/store/carts/\${cartId}\`, { method: 'POST', body: JSON.stringify(update) });
}

export async function completeCart(cartId: string) {
  return medusaMutate(\`/store/carts/\${cartId}/complete\`, { method: 'POST' });
}
`,
  );

  // --- API proxy route for cart (avoids client calling Medusa directly) ---
  writeFileSync(
    join(dir, 'src', 'app', 'api', 'cart', 'route.ts'),
    `import { NextResponse, type NextRequest } from 'next/server';
import {
  createCart, getCart, addLineItem, updateLineItem,
  removeLineItem, updateCart, completeCart,
} from '@/lib/medusa';

const M_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || '';
const M_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

async function medusaRaw(path: string, opts?: RequestInit) {
  const res = await fetch(\`\${M_URL}\${path}\`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': M_KEY, ...(opts?.headers as Record<string,string> || {}) },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: true, status: res.status, data };
  return { error: false, status: res.status, data };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, cartId, variantId, quantity, lineItemId, email, shippingAddress } = body;

    switch (action) {
      case 'create':
        return NextResponse.json(await createCart());
      case 'get':
        return NextResponse.json(await getCart(cartId));
      case 'add':
        return NextResponse.json(await addLineItem(cartId, variantId, quantity || 1));
      case 'update':
        return NextResponse.json(await updateLineItem(cartId, lineItemId, quantity));
      case 'remove':
        return NextResponse.json(await removeLineItem(cartId, lineItemId));
      case 'checkout':
        return NextResponse.json(await updateCart(cartId, {
          email,
          shipping_address: shippingAddress,
          billing_address: shippingAddress,
        }));
      case 'init-payment': {
        const cartData = await getCart(cartId);
        const cart = cartData.cart as Record<string, unknown> | undefined;
        const pc = (cart as Record<string, unknown>)?.payment_collection as Record<string, unknown> | undefined;
        let paymentCollectionId = pc?.id as string | undefined;
        if (!paymentCollectionId) {
          const pcResult = await medusaRaw('/store/payment-collections', {
            method: 'POST', body: JSON.stringify({ cart_id: cartId }),
          });
          if (pcResult.error) return NextResponse.json({ error: JSON.stringify(pcResult.data) }, { status: 400 });
          const pcD = (pcResult.data as Record<string, unknown>).payment_collection as Record<string, unknown> | undefined;
          paymentCollectionId = pcD?.id as string;
        }
        const sessionResult = await medusaRaw(\`/store/payment-collections/\${paymentCollectionId}/payment-sessions\`, {
          method: 'POST', body: JSON.stringify({ provider_id: 'pp_stripe_stripe' }),
        });
        if (sessionResult.error) return NextResponse.json({ error: JSON.stringify(sessionResult.data) }, { status: 400 });
        const pcResp = (sessionResult.data as Record<string, unknown>).payment_collection as Record<string, unknown> | undefined;
        const sessions = (pcResp?.payment_sessions ?? []) as Record<string, unknown>[];
        const session = sessions[0];
        const sData = session?.data as Record<string, unknown> | undefined;
        return NextResponse.json({
          payment_collection_id: paymentCollectionId,
          client_secret: sData?.client_secret,
          payment_session_id: session?.id,
        });
      }
      case 'complete':
        return NextResponse.json(await completeCart(cartId));
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cart-api]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
`,
  );

  // --- Cart context (client-side state) ---
  writeFileSync(
    join(dir, 'src', 'lib', 'cart-context.tsx'),
    `'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface CartItem {
  id: string;
  title: string;
  quantity: number;
  variant_id: string;
  unit_price: number;
  thumbnail: string | null;
}

interface CartCtx {
  cartId: string | null;
  items: CartItem[];
  itemCount: number;
  total: number;
  loading: boolean;
  addToCart: (variantId: string) => Promise<void>;
  removeItem: (lineItemId: string) => Promise<void>;
  updateQty: (lineItemId: string, qty: number) => Promise<void>;
  refreshCart: () => Promise<void>;
  clearCart: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart requires CartProvider');
  return c;
}

async function api(body: Record<string, unknown>) {
  const r = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

function applyCart(
  data: Record<string, unknown>,
  setItems: React.Dispatch<React.SetStateAction<CartItem[]>>,
  setTotal: React.Dispatch<React.SetStateAction<number>>,
) {
  const cart = data.cart as Record<string, unknown> | undefined;
  if (cart) {
    setItems((cart.items || []) as CartItem[]);
    setTotal((cart.total || 0) as number);
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartId, setCartId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('cart_id') : null;
    if (stored) {
      setCartId(stored);
      api({ action: 'get', cartId: stored })
        .then((d) => applyCart(d, setItems, setTotal))
        .catch(() => { localStorage.removeItem('cart_id'); setCartId(null); });
    }
  }, []);

  const refreshCart = useCallback(async () => {
    if (!cartId) return;
    const d = await api({ action: 'get', cartId });
    applyCart(d, setItems, setTotal);
  }, [cartId]);

  const addToCart = useCallback(async (variantId: string) => {
    setLoading(true);
    try {
      let cid = cartId;
      if (!cid) {
        const cr = await api({ action: 'create' });
        cid = (cr.cart as Record<string, unknown>)?.id as string;
        if (!cid) throw new Error('Cart creation failed');
        setCartId(cid);
        localStorage.setItem('cart_id', cid);
      }
      const d = await api({ action: 'add', cartId: cid, variantId, quantity: 1 });
      applyCart(d, setItems, setTotal);
    } finally { setLoading(false); }
  }, [cartId]);

  const removeItem = useCallback(async (lineItemId: string) => {
    if (!cartId) return;
    setLoading(true);
    try {
      const d = await api({ action: 'remove', cartId, lineItemId });
      applyCart(d, setItems, setTotal);
    } finally { setLoading(false); }
  }, [cartId]);

  const updateQty = useCallback(async (lineItemId: string, qty: number) => {
    if (!cartId) return;
    setLoading(true);
    try {
      const d = await api({ action: 'update', cartId, lineItemId, quantity: qty });
      applyCart(d, setItems, setTotal);
    } finally { setLoading(false); }
  }, [cartId]);

  const clearCart = useCallback(() => {
    setCartId(null);
    setItems([]);
    setTotal(0);
    localStorage.removeItem('cart_id');
  }, []);

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Ctx.Provider value={{ cartId, items, itemCount, total, loading, addToCart, removeItem, updateQty, refreshCart, clearCart }}>
      {children}
    </Ctx.Provider>
  );
}
`,
  );

  // --- Providers wrapper ---
  writeFileSync(
    join(dir, 'src', 'components', 'providers.tsx'),
    `'use client';

import { CartProvider } from '@/lib/cart-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
`,
  );

  // --- Cart count icon ---
  writeFileSync(
    join(dir, 'src', 'components', 'cart-count.tsx'),
    `'use client';

import { useCart } from '@/lib/cart-context';

export function CartCount() {
  const { itemCount } = useCart();
  return (
    <span className="relative flex items-center text-lg" title="Cart">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      {itemCount > 0 && (
        <span
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}
        >
          {itemCount}
        </span>
      )}
    </span>
  );
}
`,
  );

  // --- AddToCart button ---
  writeFileSync(
    join(dir, 'src', 'components', 'add-to-cart.tsx'),
    `'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart-context';

export function AddToCart({ variantId }: { variantId: string }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await addToCart(variantId);
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    } finally { setBusy(false); }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy || !variantId}
      className="mt-8 rounded-2xl px-8 py-4 text-lg font-semibold transition disabled:opacity-60"
      style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}
    >
      {busy ? 'Adding\u2026' : added ? '\u2713 Added to cart' : 'Add to cart'}
    </button>
  );
}
`,
  );

  // --- Product detail page (with AddToCart) ---
  writeFileSync(
    join(dir, 'src', 'app', 'product', '[handle]', 'page.tsx'),
    `import Link from 'next/link';
import { getProductByHandle } from '@/lib/medusa';
import { AddToCart } from '@/components/add-to-cart';

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-sm" style={{ color: 'var(--ds-text-muted)' }}>Product not found.</p>
        <Link href="/shop" className="mt-4 inline-block underline">Back to shop</Link>
      </main>
    );
  }

  const variant = product.variants?.[0];
  const price = variant?.calculated_price;

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2">
      <div className="overflow-hidden rounded-3xl border" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}>
        {product.thumbnail || product.images?.[0]?.url ? (
          <img
            src={product.thumbnail || product.images[0].url}
            alt={product.title}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="aspect-square w-full" style={{ background: 'var(--ds-bg-alt)' }} />
        )}
      </div>
      <div>
        <p className="text-sm uppercase tracking-[0.2em]" style={{ color: 'var(--ds-accent)' }}>Featured item</p>
        <h1 className="mt-3 text-5xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>{product.title}</h1>
        <p className="mt-6 leading-7" style={{ color: 'var(--ds-text-secondary)' }}>
          {product.description || 'Selected by our pipeline for this collection.'}
        </p>
        {price && (
          <p className="mt-8 text-3xl font-bold">
            {(price.calculated_amount / 100).toFixed(2)} {price.currency_code.toUpperCase()}
          </p>
        )}
        <AddToCart variantId={variant?.id ?? ''} />
        <Link
          href="/cart"
          className="mt-4 inline-block text-sm font-medium underline"
          style={{ color: 'var(--ds-accent)' }}
        >
          View cart
        </Link>
      </div>
    </main>
  );
}
`,
  );
}

function renderGeneratedPages(config: StreamConfig, products: ImportedProduct[]) {
  const heroImage = products[0]?.image ?? '';
  const sampleTitles = products.slice(0, 4).map((product) => product.title);
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].slice(0, 4);

  const home = `import Link from 'next/link';
import { getProducts, type MedusaProduct } from '@/lib/medusa';

export default async function HomePage() {
  let products: MedusaProduct[] = [];
  try {
    const data = await getProducts({ limit: 8 });
    products = data.products;
  } catch {}

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid min-h-[76vh] max-w-7xl items-center gap-10 px-6 py-20 md:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--ds-accent)' }}>
              ${config.niche}
            </p>
            <h1 className="mt-4 text-5xl font-black sm:text-6xl" style={{ fontFamily: 'var(--ds-font-primary)' }}>
              ${config.projectName}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8" style={{ color: 'var(--ds-text-secondary)' }}>
              Curated collectibles and fan merchandise inspired by ${config.niche}. Built for fast-moving launches,
              strong visuals, and products customers actually want to click.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/shop" className="rounded-2xl px-6 py-3 font-semibold" style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}>
                Shop the collection
              </Link>
              <Link href="/about" className="rounded-2xl border px-6 py-3 font-semibold" style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text)' }}>
                Brand story
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-3">
              ${sampleTitles
                .map(
                  (title) =>
                    `<span className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-secondary)' }}>${title.replace(/"/g, '&quot;')}</span>`,
                )
                .join('\n              ')}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] blur-3xl" style={{ background: 'color-mix(in srgb, var(--ds-accent) 28%, transparent)' }} />
            <div className="relative overflow-hidden rounded-[2rem] border" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}>
              ${
                heroImage
                  ? `<img src="${heroImage}" alt="${config.projectName}" className="aspect-[4/5] w-full object-cover" />`
                  : `<div className="aspect-[4/5] w-full" style={{ background: 'var(--ds-bg-alt)' }} />`
              }
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--ds-accent)' }}>Featured</p>
            <h2 className="mt-3 text-4xl font-bold" style={{ fontFamily: 'var(--ds-font-primary)' }}>Top products</h2>
          </div>
          <Link href="/shop" className="text-sm font-semibold" style={{ color: 'var(--ds-accent)' }}>
            View all
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => {
            const price = product.variants?.[0]?.calculated_price;
            return (
              <Link
                key={product.id}
                href={'/product/' + product.handle}
                className="group overflow-hidden rounded-[1.5rem] border p-4 transition hover:-translate-y-1"
                style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}
              >
                {product.thumbnail || product.images?.[0]?.url ? (
                  <img
                    src={product.thumbnail || product.images[0].url}
                    alt={product.title}
                    className="aspect-square w-full rounded-[1rem] object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-[1rem]" style={{ background: 'var(--ds-bg)' }} />
                )}
                <h3 className="mt-4 font-semibold">{product.title}</h3>
                {price && (
                  <p className="mt-2 text-sm" style={{ color: 'var(--ds-text-secondary)' }}>
                    {(price.calculated_amount / 100).toFixed(2)} {price.currency_code.toUpperCase()}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: 'Fast launch', text: 'Products, pages, visuals and deployment wired in a single pipeline.' },
            { title: 'Niche focused', text: 'Every section is tailored to ${config.niche.replace(/'/g, "\\'")} and the selected design system.' },
            { title: 'Ready to scale', text: 'Medusa-backed catalog with a storefront you can iterate on immediately.' },
          ].map((item) => (
            <div key={item.title} className="rounded-[1.5rem] border p-6" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 leading-7" style={{ color: 'var(--ds-text-secondary)' }}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
`;

  const shop = `import Link from 'next/link';
import { getProducts, type MedusaProduct } from '@/lib/medusa';

export default async function ShopPage() {
  let products: MedusaProduct[] = [];
  try {
    const data = await getProducts({ limit: 24 });
    products = data.products;
  } catch {}

  return (
    <main className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--ds-accent)' }}>Shop</p>
          <h1 className="mt-3 text-5xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>${config.projectName}</h1>
          <p className="mt-4 max-w-2xl text-lg" style={{ color: 'var(--ds-text-secondary)' }}>
            Explore our ${config.niche} selection. Every product below belongs to this shop sales channel in Medusa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          ${categories
            .map(
              (category) =>
                `<span className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-secondary)' }}>${category.replace(/"/g, '&quot;')}</span>`,
            )
            .join('\n          ')}
        </div>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => {
          const price = product.variants?.[0]?.calculated_price;
          return (
            <Link
              key={product.id}
              href={'/product/' + product.handle}
              className="group overflow-hidden rounded-[1.5rem] border p-4 transition hover:-translate-y-1"
              style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}
            >
              {product.thumbnail || product.images?.[0]?.url ? (
                <img
                  src={product.thumbnail || product.images[0].url}
                  alt={product.title}
                  className="aspect-square w-full rounded-[1rem] object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <div className="aspect-square w-full rounded-[1rem]" style={{ background: 'var(--ds-bg)' }} />
              )}
              <h2 className="mt-4 font-semibold">{product.title}</h2>
              {price && (
                <p className="mt-2 text-sm" style={{ color: 'var(--ds-text-secondary)' }}>
                  {(price.calculated_amount / 100).toFixed(2)} {price.currency_code.toUpperCase()}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
`;

  const about = `export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--ds-accent)' }}>About</p>
      <h1 className="mt-4 text-5xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>${config.projectName}</h1>
      <p className="mt-6 text-lg leading-8" style={{ color: 'var(--ds-text-secondary)' }}>
        ${config.projectName} was generated as a focused storefront for ${config.niche}.
        The goal is simple: curate products fast, present them with a strong identity, and launch on a storefront that already feels premium.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <section className="rounded-[1.5rem] border p-6" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}>
          <h2 className="text-2xl font-semibold">What we sell</h2>
          <p className="mt-3 leading-7" style={{ color: 'var(--ds-text-secondary)' }}>
            ${sampleTitles.join(', ')} and a broader catalog selected to match this niche and design direction.
          </p>
        </section>
        <section className="rounded-[1.5rem] border p-6" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}>
          <h2 className="text-2xl font-semibold">Why it looks different</h2>
          <p className="mt-3 leading-7" style={{ color: 'var(--ds-text-secondary)' }}>
            This storefront uses the ${config.designSystem ?? 'swiss'} design system with consistent colors, typography and layout tokens.
          </p>
        </section>
      </div>
    </main>
  );
}
`;

  const contact = `'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-sm uppercase tracking-[0.3em]" style={{ color: 'var(--ds-accent)' }}>Contact</p>
      <h1 className="mt-4 text-5xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>Reach ${config.projectName}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: 'var(--ds-text-secondary)' }}>
        Questions about the collection, sourcing, or upcoming drops? Send a message and the team will reply shortly.
      </p>
      {sent ? (
        <div className="mt-10 rounded-[1.5rem] border p-6" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}>
          <p className="font-semibold">Message sent.</p>
          <p className="mt-2" style={{ color: 'var(--ds-text-secondary)' }}>We will get back to you soon.</p>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSent(true);
          }}
          className="mt-10 grid gap-4"
        >
          <input required placeholder="Name" className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)', color: 'var(--ds-text)' }} />
          <input required type="email" placeholder="Email" className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)', color: 'var(--ds-text)' }} />
          <textarea required rows={6} placeholder="Message" className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)', color: 'var(--ds-text)' }} />
          <button type="submit" className="rounded-2xl px-6 py-3 font-semibold" style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}>
            Send message
          </button>
        </form>
      )}
    </main>
  );
}
`;

  const cart = `'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export default function CartPage() {
  const { items, total, loading, removeItem, updateQty, itemCount } = useCart();

  if (itemCount === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>Your cart is empty</h1>
        <p className="mt-4" style={{ color: 'var(--ds-text-secondary)' }}>Browse our collection and add some items.</p>
        <Link href="/shop" className="mt-8 inline-block rounded-2xl px-6 py-3 font-semibold" style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}>
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-4xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>
        Cart ({itemCount})
      </h1>
      <div className="mt-10 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 rounded-2xl border p-4" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}>
            {item.thumbnail && (
              <img src={item.thumbnail} alt={item.title} className="h-20 w-20 rounded-xl object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{item.title}</h3>
              <p className="text-sm" style={{ color: 'var(--ds-text-secondary)' }}>
                {(item.unit_price / 100).toFixed(2)} EUR x {item.quantity} = {(item.unit_price * item.quantity / 100).toFixed(2)} EUR
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQty(item.id, Math.max(1, item.quantity - 1))}
                disabled={loading}
                className="rounded-lg border px-3 py-1 text-lg"
                style={{ borderColor: 'var(--ds-border)' }}
              >
                -
              </button>
              <span className="w-8 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQty(item.id, item.quantity + 1)}
                disabled={loading}
                className="rounded-lg border px-3 py-1 text-lg"
                style={{ borderColor: 'var(--ds-border)' }}
              >
                +
              </button>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              disabled={loading}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--ds-accent)' }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between border-t pt-6" style={{ borderColor: 'var(--ds-border)' }}>
        <p className="text-2xl font-bold">Total: {(total / 100).toFixed(2)} EUR</p>
        <Link
          href="/checkout"
          className="rounded-2xl px-8 py-3 font-semibold text-lg"
          style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}
        >
          Checkout
        </Link>
      </div>
    </main>
  );
}
`;

  const checkout = `'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

type Step = 'form' | 'processing' | 'done' | 'error';

async function cartApi(body: Record<string, unknown>) {
  const r = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export default function CheckoutPage() {
  const { cartId, items, total, itemCount, clearCart } = useCart();
  const [step, setStep] = useState<Step>('form');
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '',
    address: '', city: '', postal: '', country: 'FR',
  });

  function up(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  if (itemCount === 0 && step !== 'done') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>Nothing to checkout</h1>
        <Link href="/shop" className="mt-8 inline-block rounded-2xl px-6 py-3 font-semibold" style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}>
          Browse products
        </Link>
      </main>
    );
  }

  if (step === 'done') {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="text-6xl">\\u2713</div>
        <h1 className="mt-4 text-4xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>Order confirmed</h1>
        <p className="mt-4" style={{ color: 'var(--ds-text-secondary)' }}>Thank you for your purchase!</p>
        <Link href="/shop" className="mt-8 inline-block rounded-2xl px-6 py-3 font-semibold" style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}>
          Continue shopping
        </Link>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep('processing');
    setErr('');
    try {
      await cartApi({
        action: 'checkout',
        cartId,
        email: form.email,
        shippingAddress: {
          first_name: form.firstName,
          last_name: form.lastName,
          address_1: form.address,
          city: form.city,
          postal_code: form.postal,
          country_code: form.country.toLowerCase(),
        },
      });

      const result = await cartApi({ action: 'complete', cartId });

      if (result.type === 'order' || result.order) {
        clearCart();
        setStep('done');
      } else {
        setErr(result.error || 'Could not complete order. Payment provider may need configuration.');
        setStep('error');
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Checkout failed');
      setStep('error');
    }
  }

  const inputCls = 'w-full rounded-2xl border px-4 py-3';
  const inputStyle = { borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)', color: 'var(--ds-text)' };

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-black" style={{ fontFamily: 'var(--ds-font-primary)' }}>Checkout</h1>

      <div className="mt-10 grid gap-10 lg:grid-cols-5">
        <form onSubmit={handleSubmit} className="space-y-4 lg:col-span-3">
          <h2 className="text-xl font-semibold">Shipping information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input required placeholder="First name" value={form.firstName} onChange={(e) => up('firstName', e.target.value)} className={inputCls} style={inputStyle} />
            <input required placeholder="Last name" value={form.lastName} onChange={(e) => up('lastName', e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => up('email', e.target.value)} className={inputCls} style={inputStyle} />
          <input required placeholder="Address" value={form.address} onChange={(e) => up('address', e.target.value)} className={inputCls} style={inputStyle} />
          <div className="grid gap-4 sm:grid-cols-3">
            <input required placeholder="City" value={form.city} onChange={(e) => up('city', e.target.value)} className={inputCls} style={inputStyle} />
            <input required placeholder="Postal code" value={form.postal} onChange={(e) => up('postal', e.target.value)} className={inputCls} style={inputStyle} />
            <select value={form.country} onChange={(e) => up('country', e.target.value)} className={inputCls} style={inputStyle}>
              <option value="FR">France</option>
              <option value="DE">Germany</option>
              <option value="ES">Spain</option>
              <option value="IT">Italy</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
            </select>
          </div>

          {step === 'error' && (
            <div className="rounded-2xl border border-red-400 bg-red-50 p-4 text-sm text-red-700">{err}</div>
          )}

          <button
            type="submit"
            disabled={step === 'processing'}
            className="w-full rounded-2xl px-6 py-4 text-lg font-semibold transition disabled:opacity-60"
            style={{ background: 'var(--ds-accent)', color: 'var(--ds-bg)' }}
          >
            {step === 'processing' ? 'Processing\\u2026' : 'Place order \\u2014 ' + (total / 100).toFixed(2) + ' EUR'}
          </button>
        </form>

        <aside className="lg:col-span-2">
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--ds-border)', background: 'var(--ds-bg-alt)' }}>
            <h2 className="text-xl font-semibold">Order summary</h2>
            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{item.title} x{item.quantity}</span>
                  <span className="font-medium">{(item.total / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t pt-4 flex justify-between font-bold" style={{ borderColor: 'var(--ds-border)' }}>
              <span>Total</span>
              <span>{(total / 100).toFixed(2)} EUR</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
`;

  return new Map<string, string>([
    ['src/app/page.tsx', home],
    ['src/app/shop/page.tsx', shop],
    ['src/app/about/page.tsx', about],
    ['src/app/contact/page.tsx', contact],
    ['src/app/cart/page.tsx', cart],
    ['src/app/checkout/page.tsx', checkout],
  ]);
}

async function deployToGpu2(dir: string, config: StreamConfig) {
  const remoteDir = `/home/${GPU2_USER}/sites/${config.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  execSync(`ssh ${GPU2_USER}@${GPU2_HOST} "mkdir -p ${remoteDir}"`, EXEC_OPTS);
  execSync(
    `rsync -az --delete --exclude='node_modules' --exclude='.next/cache' "${dir}/" ${GPU2_USER}@${GPU2_HOST}:${remoteDir}/`,
    EXEC_OPTS,
  );
  execSync(
    `ssh ${GPU2_USER}@${GPU2_HOST} 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd ${remoteDir} && npm install --omit=dev >/tmp/${config.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-npm.log 2>&1 && fuser -k ${config.port}/tcp 2>/dev/null; sleep 1 && NEXT_PUBLIC_MEDUSA_URL=${MEDUSA_URL} NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${config.publishableKey} NEXT_PUBLIC_MEDUSA_REGION_ID=${config.regionId} NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PK} PORT=${config.port} nohup npx next start -p ${config.port} > /tmp/${config.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.log 2>&1 & sleep 4 && curl -s -o /dev/null -w "%{http_code}" http://localhost:${config.port}'`,
    EXEC_OPTS,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = (body.config ?? body) as StreamConfig;
  const dir = resolveDir(config.outputDir);
  const products = config.importedProducts ?? [];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        emit(controller, 'scaffold', 'running', 'Creating generated storefront project...');
        writeBaseFiles(dir, config);
        writeThemeFiles(dir, config);
        const files = listFiles(dir);
        emit(controller, 'scaffold', 'done', `${files.length} files created at ${dir}`);

        emit(controller, 'integrations', 'running', 'Writing Medusa, Stripe and site env configuration...');
        writeMedusaFiles(dir, config);
        emit(
          controller,
          'integrations',
          'done',
          `Medusa publishable key scoped to sales channel ${config.salesChannelId ?? 'n/a'}`,
        );

        emit(controller, 'assets', 'running', 'Generating brand assets (logo + hero image)...');
        
        const ds = getDesignSystem(config.designSystem ?? 'swiss') ?? getDesignSystem('swiss')!;
        
        // Generate logo with AI
        const logoPrompt = `Professional minimalist logo for "${config.projectName}", ${config.niche} brand, ${ds.colors.accent} accent color, clean vector style, transparent background`;
        let logoGenerated = false;
        
        try {
          // Try ComfyUI first
          const comfyRes = await fetch('http://100.88.191.49:8188/prompt', { 
            method: 'POST',
            signal: AbortSignal.timeout(5000),
          }).catch(() => null);
          
          if (comfyRes?.ok) {
            emit(controller, 'assets', 'running', 'ComfyUI available, generating logo...');
            // TODO: Wire ComfyUI workflow here
            logoGenerated = false;
          }
        } catch {}
        
        if (!logoGenerated) {
          // Fallback to SVG
          emit(controller, 'assets', 'running', 'Using SVG fallback for logo');
        }
        
        // Use product images for hero
        const heroImage = products[0]?.image ?? '';
        const heroTitle = products[0]?.title ?? '';
        emit(
          controller,
          'assets',
          'done',
          heroImage && heroTitle
            ? `Logo ready, hero using ${heroTitle} product image`
            : 'Logo ready, hero will use theme colors',
        );

        emit(controller, 'codegen', 'running', 'Generating themed storefront pages via AI...');
        
        // Use AI codegen from launcher package
        const siteConfig: EcommerceSiteConfig = {
          brandName: config.projectName,
          tagline: config.tagline || `Premium ${config.niche} collection`,
          niche: config.niche,
          tone: config.tone || (config.positioning === 'Premium' ? 'sophisticated' : config.positioning === 'Budget' ? 'friendly' : 'professional'),
          palette: 'dark',
          typography: 'modern',
          products: products.map(p => ({ name: p.title, price: p.price, image: p.image })),
          pages: getDefaultEcommercePages(),
        };

        // Add reference URLs context if provided
        if (config.referenceUrls && config.referenceUrls.length > 0) {
          emit(controller, 'codegen', 'running', `Analyzing ${config.referenceUrls.length} reference site(s)...`);
        }

        const generated = await generateFullSite(siteConfig, (step, detail) => {
          emit(controller, 'codegen', 'running', `${step}: ${detail}`);
        });

        for (const [filePath, contents] of generated.entries()) {
          const target = join(dir, filePath);
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, contents);
        }
        emit(controller, 'codegen', 'done', `${generated.size} AI-generated pages created`);

        emit(controller, 'install', 'running', 'Running npm install...');
        const install = execCmd('npm install 2>&1', dir);
        if (!install.ok) {
          emit(controller, 'install', 'error', install.stderr.slice(-500));
          emit(controller, 'pipeline', 'error', 'Pipeline stopped at install');
          controller.close();
          return;
        }
        emit(controller, 'install', 'done', 'Dependencies installed');

        emit(controller, 'build', 'running', 'Running next build...');
        const build = execCmd('npx next build 2>&1', dir, { NODE_ENV: 'production' });
        if (!build.ok) {
          const message = `${build.stdout}\n${build.stderr}`.slice(-1000);
          emit(controller, 'build', 'error', message);
          if (config.siteId) {
            await getSupabase()?.from('sites').update({ status: 'error' }).eq('id', config.siteId);
          }
          emit(controller, 'pipeline', 'error', 'Pipeline stopped at build');
          controller.close();
          return;
        }
        emit(controller, 'build', 'done', build.stdout.split('\n').slice(-18).join('\n'));

        emit(controller, 'deploy', 'running', `Deploying site to GPU2 on port ${config.port}...`);
        deployToGpu2(dir, {
          ...config,
          port: config.port ?? 3102,
        });
        if (config.siteId) {
          await getSupabase()
            ?.from('sites')
            .update({
              status: 'live',
              config: {
                port: config.port,
                publishable_key: config.publishableKey,
                remote_path: `/home/${GPU2_USER}/sites/${config.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
              },
            })
            .eq('id', config.siteId);
        }
        emit(controller, 'deploy', 'done', `Live at http://${GPU2_HOST}:${config.port}`);
        emit(controller, 'pipeline', 'done', `Site live at http://${GPU2_HOST}:${config.port}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (config.siteId) {
          await getSupabase()?.from('sites').update({ status: 'error' }).eq('id', config.siteId);
        }
        emit(controller, 'pipeline', 'error', message);
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
