import { timingSafeEqual } from 'node:crypto';

export function cookieToken(header: string | undefined): string | undefined {
  const values = (header ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith('meridiano_session='));
  const token = values.length === 1 ? values[0]?.slice('meridiano_session='.length) : undefined;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
export function matches(provided: unknown, expected: string): boolean {
  return typeof provided === 'string' && /^[A-Za-z0-9_-]{43}$/.test(provided) && provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
