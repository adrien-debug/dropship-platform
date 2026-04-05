import { createHash, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import type { NextAuthOptions } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { isAdmin } from './admin-check';

function stableIdFromEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32);
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const expected = process.env.ONEPEACE_SHOP_PASSWORD;
        if (!expected || !credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        if (!isAdmin(email)) return null;
        try {
          const a = Buffer.from(credentials.password, 'utf8');
          const b = Buffer.from(expected, 'utf8');
          if (a.length !== b.length) return null;
          if (!timingSafeEqual(a, b)) return null;
        } catch {
          return null;
        }
        return {
          id: stableIdFromEmail(email),
          email,
          name: email.split('@')[0] ?? email,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return isAdmin(user.email);
    },
    async jwt({ token, user }) {
      if (user) {
        const em = user.email;
        token.email = typeof em === 'string' ? em : undefined;
        const idFromUser =
          typeof user.id === 'string' && user.id.length > 0
            ? user.id
            : user.email
              ? stableIdFromEmail(user.email)
              : undefined;
        const nextSub = idFromUser ?? (typeof token.sub === 'string' ? token.sub : undefined);
        if (nextSub !== undefined) {
          token.sub = nextSub;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? '';
        session.user.id = (token.sub as string) ?? '';
      }
      return session;
    },
  },
};

export interface SessionFromRequest {
  userId?: string;
  email?: string;
}

/**
 * Resolves NextAuth JWT from the incoming request (Route Handlers / middleware).
 */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionFromRequest | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const token = await getToken({ req, secret });
  if (!token) return null;
  const userId = typeof token.sub === 'string' ? token.sub : undefined;
  const email = typeof token.email === 'string' ? token.email : undefined;
  if (userId === undefined && email === undefined) return null;
  return { userId, email };
}
