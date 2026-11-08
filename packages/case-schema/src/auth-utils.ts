// Utilidades de autenticación (T6-01)
// Usa Web Crypto API (Node 22+) para hash/verify de contraseñas

const ALGORITHM = 'PBKDF2';
const HASH_ALGORITHM = 'SHA-256';
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: ALGORITHM },
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: ALGORITHM, salt, iterations: ITERATIONS, hash: HASH_ALGORITHM },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  const hash = new Uint8Array(derivedBits);
  // Formato: $iterations$salt$hash (base64)
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...hash));
  return `$${ITERATIONS}$${saltB64}$${hashB64}`;
}

interface ParsedHash {
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  expectedHash: Uint8Array<ArrayBuffer>;
}

/** Descompone un hash `$iteraciones$sal$hash` (base64) o devuelve null si no es válido. */
function parseStoredHash(storedHash: string): ParsedHash | null {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== '') return null;
  const [, iterationsStr, saltStr, hashStr] = parts;
  if (!iterationsStr || !saltStr || !hashStr) return null;
  const iterations = parseInt(iterationsStr, 10);
  if (!Number.isFinite(iterations)) return null;
  return {
    iterations,
    salt: Uint8Array.from(atob(saltStr), c => c.charCodeAt(0)),
    expectedHash: Uint8Array.from(atob(hashStr), c => c.charCodeAt(0)),
  };
}

/** Comparación en tiempo constante. */
function constantTimeEqual(a: Uint8Array<ArrayBuffer>, b: Uint8Array<ArrayBuffer>): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x !== undefined && y !== undefined) {
      diff |= x ^ y;
    }
  }
  return diff === 0;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parsed = parseStoredHash(storedHash);
    if (parsed === null) return false;

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: ALGORITHM },
      false,
      ['deriveBits'],
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: ALGORITHM, salt: parsed.salt, iterations: parsed.iterations, hash: HASH_ALGORITHM },
      keyMaterial,
      KEY_LENGTH * 8,
    );
    const actualHash = new Uint8Array(derivedBits);

    return constantTimeEqual(actualHash, parsed.expectedHash);
  } catch {
    return false;
  }
}
