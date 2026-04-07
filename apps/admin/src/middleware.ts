import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdminToken } from './app/api/auth/route';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/api/health',
  '/favicon.svg',
  '/_next',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('dp_session')?.value;
  if (verifyAdminToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg).*)'],
};
