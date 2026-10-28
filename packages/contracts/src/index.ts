/** Solo estado público de proceso; no acredita DB, sesión ni juego operativo. */
export interface HealthResponse { status: 'ok' }

/** La respuesta HTTP es una frontera no confiable para el navegador. */
export function isHealthResponse(value: unknown): value is HealthResponse {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'ok';
}
