#!/usr/bin/env bash
# Setup golden template on GPU2 for fast site deployment.
# This pre-installs node_modules and creates a ready-to-use Next.js skeleton.
# Run: bash scripts/setup-golden-template.sh

set -euo pipefail

GPU2_HOST="${GPU2_HOST:-100.110.74.114}"
GPU2_USER="${GPU2_USER:-comput3}"
GOLDEN_DIR="/home/${GPU2_USER}/golden-template"

echo "[golden] Creating golden template on ${GPU2_USER}@${GPU2_HOST}:${GOLDEN_DIR}"

ssh "${GPU2_USER}@${GPU2_HOST}" bash -s <<'REMOTE'
set -euo pipefail
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

GOLDEN_DIR="$HOME/golden-template"
rm -rf "$GOLDEN_DIR"
mkdir -p "$GOLDEN_DIR/src/app" "$GOLDEN_DIR/src/lib" "$GOLDEN_DIR/src/components" "$GOLDEN_DIR/public/assets"

cat > "$GOLDEN_DIR/package.json" <<'PKG'
{
  "name": "golden-template",
  "version": "0.1.0",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start" },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "clsx": "^2.1.0",
    "@stripe/stripe-js": "^5.5.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.0"
  }
}
PKG

cat > "$GOLDEN_DIR/tsconfig.json" <<'TSC'
{
  "compilerOptions": {
    "target": "ES2017", "lib": ["dom","dom.iterable","esnext"],
    "allowJs": true, "skipLibCheck": true, "strict": true, "noEmit": true,
    "esModuleInterop": true, "module": "esnext", "moduleResolution": "bundler",
    "resolveJsonModule": true, "isolatedModules": true, "jsx": "preserve",
    "incremental": true, "plugins": [{"name": "next"}],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
TSC

cat > "$GOLDEN_DIR/postcss.config.mjs" <<'POST'
export default { plugins: { '@tailwindcss/postcss': {} } };
POST

cat > "$GOLDEN_DIR/next.config.ts" <<'NEXT'
import type { NextConfig } from 'next';
const nextConfig: NextConfig = { reactStrictMode: true };
export default nextConfig;
NEXT

cat > "$GOLDEN_DIR/src/app/page.tsx" <<'PAGE'
export default function HomePage() {
  return <main><h1>Golden Template</h1></main>;
}
PAGE

cat > "$GOLDEN_DIR/src/app/layout.tsx" <<'LAYOUT'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
LAYOUT

cd "$GOLDEN_DIR"
npm install --omit=dev
echo "[golden] node_modules installed: $(du -sh node_modules | cut -f1)"
echo "[golden] Golden template ready at $GOLDEN_DIR"
REMOTE

echo "[golden] Done. GPU2 golden template is ready."
