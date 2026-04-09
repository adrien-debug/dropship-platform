import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

const PUBLIC_PATHS = [
  '/login',
  '/api',
  '/favicon.svg',
  '/_next',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (process.env.ADMIN_BYPASS_AUTH === 'true') {
    return NextResponse.next();
  }

  const token = req.cookies.get('dp_session')?.value;
  if (await verifyAdminToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg).*)'],
};
