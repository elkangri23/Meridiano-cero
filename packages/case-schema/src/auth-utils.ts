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

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== '') return false;
    const iterationsStr = parts[1];
    const saltStr = parts[2];
    const hashStr = parts[3];
    if (!iterationsStr || !saltStr || !hashStr) return false;
    const iterations = parseInt(iterationsStr, 10);
    if (!Number.isFinite(iterations)) return false;
    const salt = Uint8Array.from(atob(saltStr), c => c.charCodeAt(0));
    const expectedHash = Uint8Array.from(atob(hashStr), c => c.charCodeAt(0));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: ALGORITHM },
      false,
      ['deriveBits'],
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: ALGORITHM, salt, iterations, hash: HASH_ALGORITHM },
      keyMaterial,
      KEY_LENGTH * 8,
    );
    const actualHash = new Uint8Array(derivedBits);

    // Comparación en tiempo constante
    if (actualHash.length !== expectedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < actualHash.length; i++) {
      diff |= actualHash[i] ^ expectedHash[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}