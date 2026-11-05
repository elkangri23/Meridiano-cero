// Política de destinos para las conexiones IA personales (T7-02, SPEC-011).
// En el VPS, aportar una clave personal no autoriza URLs arbitrarias: se
// rechazan loopback, red privada, metadata y credenciales en la URL. En
// desarrollo (instalación en casa) se admite loopback y LAN local, que es
// donde viven Ollama y LM Studio. La configuración del administrador (entorno
// del servidor) no pasa por aquí: es de confianza del operador.
//
// Decisión sobre `localhost` (2026-11-05): donde el loopback ya está
// permitido, el nombre `localhost` (y `::1`) se normaliza a `127.0.0.1`
// (Ollama en ambos modos; OpenAI-compatible en desarrollo). No cambia nada
// en el VPS: para Ollama el destino 127.0.0.1 ya era el único aceptado y
// apunta al propio servidor, así que una conexión Ollama guardada en la
// versión alojada sigue sin alcanzar el ordenador del usuario (la UI lo
// advierte) y «Probar» lo muestra como no disponible. En producción,
// OpenAI-compatible sigue rechazando el loopback, pero con un mensaje que
// explica el motivo en vez de un error genérico o engañoso.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type DestinationMode = 'development' | 'production';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata']);

// Rangos IPv4 no públicos (primera octeto + rango del segundo).
const IPV4_NON_PUBLIC_RANGES: Array<{ first: number; secondMin: number; secondMax: number }> = [
  { first: 10, secondMin: 0, secondMax: 255 }, // 10/8
  { first: 172, secondMin: 16, secondMax: 31 }, // 172.16/12
  { first: 192, secondMin: 168, secondMax: 168 }, // 192.168/16
  { first: 127, secondMin: 0, secondMax: 255 }, // 127/8 loopback
  { first: 169, secondMin: 254, secondMax: 254 }, // 169.254/16 enlace local
  { first: 100, secondMin: 64, secondMax: 127 }, // 100.64/10 CGNAT
  { first: 198, secondMin: 18, secondMax: 19 }, // 198.18/15 benchmarking, no enrutable
];

function isNonPublicIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  if (a === 0 || a >= 224) return true; // 0/8 y multicast/reservada
  return IPV4_NON_PUBLIC_RANGES.some(range => a === range.first && b >= range.secondMin && b <= range.secondMax);
}

function isNonPublicIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 única local
  if (lower.startsWith('ff')) return true; // multicast
  return false;
}

function isNonPublicIP(ip: string): boolean {
  return isIP(ip) === 4 ? isNonPublicIPv4(ip) : isNonPublicIPv6(ip);
}

async function hostnameResolvesToPublic(hostname: string): Promise<boolean> {
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    return false;
  }
  if (addresses.length === 0) return false;
  return addresses.some(entry => !isNonPublicIP(entry.address));
}

function parseBaseUrl(baseUrl: string): URL {
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error('La URL del endpoint no es válida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('La URL del endpoint no es válida.');
  }
  return url;
}

function normalizeLoopbackHostname(hostname: string): string {
  // URL.hostname devuelve '[::1]' con corchetes para IPv6 literal.
  const bare = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (bare === 'localhost' || bare === '::1') return '127.0.0.1';
  return hostname;
}

function isLoopbackHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower === '::1') return true;
  if (isIP(lower) === 4) return Number(lower.split('.')[0] ?? 0) === 127;
  return false;
}

function withNormalizedLoopback(url: URL): URL {
  const normalized = new URL(url.href);
  normalized.hostname = normalizeLoopbackHostname(url.hostname);
  return normalized;
}

function rejectBlockedHostname(hostname: string): void {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower) || lower.endsWith('.localhost')) {
    throw new Error('Ese destino no está permitido en este entorno.');
  }
}

function validateOllamaBaseUrl(baseUrl: string): string {
  // Solo origen loopback literal, como el transporte Ollama existente.
  // `localhost` (y `::1`) se normalizan a 127.0.0.1: es el mismo destino que
  // ya se aceptaba, así el formulario funciona con el host que todo el mundo
  // teclea; en el VPS sigue apuntando al propio servidor (ver cabecera).
  const url = parseBaseUrl(baseUrl);
  const normalized = withNormalizedLoopback(url);
  if (normalized.protocol !== 'http:' || normalized.hostname !== '127.0.0.1' || normalized.pathname !== '/') {
    throw new Error('Ollama requiere un origen HTTP literal de 127.0.0.1 sin ruta.');
  }
  return normalized.origin;
}

async function validateOpenAiCompatibleBaseUrl(baseUrl: string, mode: DestinationMode): Promise<string> {
  const url = parseBaseUrl(baseUrl);
  // En desarrollo se admite loopback (LM Studio) y LAN local; solo se
  // bloquea el endpoint de metadata. `localhost` se normaliza a 127.0.0.1.
  if (mode === 'development') {
    const lower = url.hostname.toLowerCase();
    if (lower === 'metadata.google.internal' || lower === 'metadata') {
      throw new Error('Ese destino no está permitido en este entorno.');
    }
    const normalized = withNormalizedLoopback(url);
    return normalized.origin + normalized.pathname.replace(/\/+$/, '');
  }
  // En producción el loopback se rechaza con un mensaje que explica el
  // motivo (antes caía en el error genérico de HTTPS o, en la UI, en el
  // mensaje engañoso de nombre duplicado): en la versión alojada el servidor
  // no puede alcanzar el ordenador del usuario, así que localhost apunta al
  // propio VPS.
  if (isLoopbackHostname(url.hostname)) {
    throw new Error('Ese destino no está permitido en la versión alojada: localhost apunta al propio servidor, no a tu ordenador. Para usar Ollama o LM Studio en local, juega con una instalación en casa.');
  }
  // En producción: HTTPS obligatorio y nada de red privada, metadata ni
  // hostnames que no resuelvan a IP pública.
  if (url.protocol !== 'https:') {
    throw new Error('En el servidor, los endpoints compatibles deben usar HTTPS.');
  }
  rejectBlockedHostname(url.hostname);
  const ipVersion = isIP(url.hostname);
  if (ipVersion !== 0 && isNonPublicIP(url.hostname)) {
    throw new Error('Ese destino no está permitido en este entorno.');
  }
  if (ipVersion === 0 && !(await hostnameResolvesToPublic(url.hostname))) {
    throw new Error('No se pudo comprobar que ese destino sea público.');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

/**
 * Valida y normaliza la baseUrl de una conexión personal. Devuelve la URL
 * normalizada (sin barra final). Lanza Error con mensaje para el usuario si
 * el destino no está permitido.
 */
export async function validateConnectionBaseUrl(
  adapterId: string,
  baseUrl: string,
  mode: DestinationMode,
): Promise<string> {
  if (adapterId === 'ollama') return validateOllamaBaseUrl(baseUrl);
  if (adapterId === 'openai-compatible') return validateOpenAiCompatibleBaseUrl(baseUrl, mode);
  throw new Error('Ese proveedor no admite una URL personalizada.');
}
