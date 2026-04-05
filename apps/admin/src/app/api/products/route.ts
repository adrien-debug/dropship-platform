import { NextRequest, NextResponse } from 'next/server';

const STOREFRONT_URL = process.env.STOREFRONT_URL || 'http://100.110.74.114:3100';

export async function GET() {
  try {
    const res = await fetch(`${STOREFRONT_URL}/api/products?limit=1000`, {
      next: { revalidate: 0 },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[admin:products] Fetch error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ items: [], total: 0 }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const product = await req.json();

    if (!product.id || !product.name) {
      return NextResponse.json({ error: 'Missing id or name' }, { status: 400 });
    }

    console.log('[admin:products] Save product:', product.id, product.name);

    return NextResponse.json({
      ok: true,
      message: 'Product saved. Note: static catalog requires code update + redeploy to persist.',
      product,
    });
  } catch (err) {
    console.error('[admin:products] Save error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  console.log('[admin:products] Delete product:', id);

  return NextResponse.json({
    ok: true,
    message: 'Product marked for deletion. Requires code update + redeploy.',
  });
}
