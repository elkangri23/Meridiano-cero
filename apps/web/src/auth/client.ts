import { isSessionDto } from '@meridiano/contracts';
import type { SessionDto } from '@meridiano/contracts';

/** Sesión que devuelven registro e inicio de sesión: incluye si el correo está verificado. */
export interface AuthSession {
  profile: { id: string; displayName: string; emailVerified: boolean };
  csrfToken: string;
}

export interface AuthApi {
  register(email: string, displayName: string, password: string, signal: AbortSignal): Promise<AuthSession>;
  login(email: string, password: string, signal: AbortSignal): Promise<AuthSession>;
  verifyEmail(token: string, signal: AbortSignal): Promise<void>;
  resendVerification(identity: AuthSession, signal: AbortSignal): Promise<void>;
  requestRecovery(email: string, signal: AbortSignal): Promise<void>;
  confirmRecovery(token: string, newPassword: string, signal: AbortSignal): Promise<void>;
  me(signal: AbortSignal): Promise<SessionDto | null>;
}

export type AuthErrorKind =
  | 'unavailable' | 'invalid' | 'email_taken' | 'bad_credentials'
  | 'bad_token' | 'rate_limited' | 'not_configured' | 'session';

export class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) { super(kind); }
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new AuthError('invalid');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0; let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 131072) throw new AuthError('invalid');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    try { await reader.cancel(); } catch { throw new AuthError('invalid'); }
    throw new AuthError('invalid');
  } finally { reader.releaseLock(); }
}

async function request(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  } catch { throw new AuthError('unavailable'); }
}

function isValidBody(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}

function isAuthProfile(profile: unknown): profile is AuthSession['profile'] {
  if (!isValidBody(profile)) return false;
  if (Object.keys(profile).sort().join(',') !== 'displayName,emailVerified,id') return false;
  return isUuid(profile.id) && typeof profile.displayName === 'string' && profile.displayName.trim().length > 0 &&
    profile.displayName.length <= 64 && typeof profile.emailVerified === 'boolean';
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isValidBody(value)) return false;
  if (Object.keys(value).sort().join(',') !== 'csrfToken,profile') return false;
  return isAuthProfile(value.profile) &&
    typeof value.csrfToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.csrfToken);
}

const tokenErrorCodes = new Set(['INVALID_VERIFICATION_TOKEN', 'INVALID_RECOVERY_TOKEN']);
function errorCode(body: unknown): string {
  if (!isValidBody(body) || !isValidBody(body.error)) return '';
  return typeof body.error.code === 'string' ? body.error.code : '';
}
function errorKind(status: number, body: unknown): AuthErrorKind {
  const code = errorCode(body);
  if (status === 401) return code === 'SESSION_REQUIRED' ? 'session' : 'bad_credentials';
  if (status === 409 && code === 'EMAIL_ALREADY_REGISTERED') return 'email_taken';
  if (status === 429) return 'rate_limited';
  if (status === 400) return tokenErrorCodes.has(code) ? 'bad_token' : 'invalid';
  if (status === 503 && code === 'EMAIL_NOT_CONFIGURED') return 'not_configured';
  return 'unavailable';
}

async function read(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    const body = await boundedJson(response).catch(() => null);
    throw new AuthError(errorKind(response.status, body));
  }
  const body = await boundedJson(response);
  if (!isValidBody(body)) throw new AuthError('invalid');
  return body;
}

async function readSession(response: Response): Promise<AuthSession> {
  const body = await read(response);
  if (!isAuthSession(body)) throw new AuthError('invalid');
  return body;
}

function jsonHeaders(): Record<string, string> {
  return { 'content-type': 'application/json' };
}

export const authApi: AuthApi = {
  async register(email: string, displayName: string, password: string, signal: AbortSignal): Promise<AuthSession> {
    if (!email.includes('@') || !displayName.trim() || password.length < 12) throw new AuthError('invalid');
    return readSession(await request('/api/v1/auth/register', signal,
      { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ email, displayName: displayName.trim(), password }) }));
  },

  async login(email: string, password: string, signal: AbortSignal): Promise<AuthSession> {
    if (!email.includes('@') || !password) throw new AuthError('invalid');
    return readSession(await request('/api/v1/auth/login', signal,
      { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ email, password }) }));
  },

  async verifyEmail(token: string, signal: AbortSignal): Promise<void> {
    if (!token) throw new AuthError('invalid');
    const body = await read(await request('/api/v1/auth/verify-email', signal,
      { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ token }) }));
    if (body.verified !== true) throw new AuthError('invalid');
  },

  async resendVerification(identity: AuthSession, signal: AbortSignal): Promise<void> {
    const body = await read(await request('/api/v1/auth/verify-email/resend', signal,
      { method: 'POST', headers: { ...jsonHeaders(), 'x-csrf-token': identity.csrfToken }, body: '{}' }));
    if (typeof body.message !== 'string') throw new AuthError('invalid');
  },

  async requestRecovery(email: string, signal: AbortSignal): Promise<void> {
    if (!email.includes('@')) throw new AuthError('invalid');
    const body = await read(await request('/api/v1/auth/recovery/request', signal,
      { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ email }) }));
    if (typeof body.message !== 'string') throw new AuthError('invalid');
  },

  async confirmRecovery(token: string, newPassword: string, signal: AbortSignal): Promise<void> {
    if (!token || newPassword.length < 12) throw new AuthError('invalid');
    const body = await read(await request('/api/v1/auth/recovery/confirm', signal,
      { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ token, newPassword }) }));
    if (typeof body.message !== 'string') throw new AuthError('invalid');
  },

  async me(signal: AbortSignal): Promise<SessionDto | null> {
    const response = await request('/api/v1/me', signal);
    if (response.status === 401) { await response.body?.cancel(); return null; }
    const body = await read(response);
    if (!isSessionDto(body)) throw new AuthError('invalid');
    return body;
  },
};
