import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { DEMO_ACCOUNTS, type DemoRole, type DemoSession } from '@/lib/demo-accounts';
import { isDemoUserActive } from '@/lib/demo-store';

const COOKIE_NAME = 'student-aid-demo-session';
const SESSION_SECONDS = 60 * 60 * 8;
const secretKey = Symbol.for('student-aid-tracker.demo-session-secret');
const root = globalThis as typeof globalThis & { [secretKey]?: string };
const DEVELOPMENT_SECRET = root[secretKey] ?? (root[secretKey] = randomBytes(32).toString('base64url'));
function signingSecret(): string | null {
  if (process.env.DEMO_SESSION_SECRET) return process.env.DEMO_SESSION_SECRET;
  return process.env.NODE_ENV === 'development' ? DEVELOPMENT_SECRET : null;
}

export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE_ENABLED === 'true'
    && !!process.env.DEMO_SESSION_SECRET
    && !!process.env.DEMO_ACCESS_PASSWORD;
}

function signature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createDemoToken(session: DemoSession): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({
    email: session.email,
    name: session.name,
    role: session.role,
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
  })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

function isDemoRole(value: unknown): value is DemoRole {
  return value === 'SUPER_ADMIN' || value === 'WORKING_SCHOLAR_ADMIN'
    || value === 'ACADEMIC_ADMIN' || value === 'STUDENT';
}

export function verifyDemoToken(token: string | undefined): DemoSession | null {
  const secret = signingSecret();
  if (!secret || !token) return null;
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra) return null;
  const expectedSignature = signature(payload, secret);
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: unknown; name?: unknown; role?: unknown; expiresAt?: unknown;
    };
    if (typeof value.email !== 'string' || typeof value.name !== 'string'
      || !isDemoRole(value.role) || typeof value.expiresAt !== 'number' || value.expiresAt <= Date.now()) return null;
    const account = DEMO_ACCOUNTS.find((item) => item.email === value.email && item.role === value.role);
    if (!account || value.name !== account.name) return null;
    return { email: account.email, name: account.name, role: account.role };
  } catch {
    return null;
  }
}

export async function getDemoSession(): Promise<DemoSession | null> {
  const cookieStore = await cookies();
  const session = verifyDemoToken(cookieStore.get(COOKIE_NAME)?.value);
  return session && isDemoUserActive(session.email) ? session : null;
}

export function demoCookieName(): string {
  return COOKIE_NAME;
}

export function demoCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_SECONDS,
  };
}

export function createDemoSessionForRole(role: unknown): DemoSession | null {
  if (typeof role !== 'string') return null;
  const account = DEMO_ACCOUNTS.find((item) => item.role === role);
  if (!account || !isDemoUserActive(account.email)) return null;
  return { email: account.email, name: account.name, role: account.role };
}

export function demoSigningIsAvailable(): boolean {
  return signingSecret() !== null;
}
