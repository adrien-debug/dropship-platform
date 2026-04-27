import { NextRequest, NextResponse } from 'next/server';
import { searchProducts } from '@/lib/suppliers/aliexpress';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const keywords = req.nextUrl.searchParams.get('keywords') || 'wireless headphones';
  const result = await searchProducts({ keywords, page: 1, pageSize: 5 });
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
