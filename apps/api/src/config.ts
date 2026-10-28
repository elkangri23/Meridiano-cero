export interface BootstrapConfig { host: '127.0.0.1'; port: number }

function validateOrigin(value: string | undefined): void {
  if (!value) throw new Error('Falta PUBLIC_ORIGIN.');
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== value) throw new Error();
  } catch {
    throw new Error('PUBLIC_ORIGIN debe ser un origen HTTP de 127.0.0.1 sin ruta ni credenciales.');
  }
}

/** Arranque mínimo sin DB ni identidad; su configuración completa llega en T1-03. */
export function readBootstrapConfig(env: NodeJS.ProcessEnv): BootstrapConfig {
  if (env.APP_MODE !== 'development') throw new Error('La base actual solo admite APP_MODE=development explícito.');
  if (env.API_HOST !== '127.0.0.1') throw new Error('API_HOST debe ser 127.0.0.1.');
  const rawPort = env.API_PORT;
  if (!rawPort || !/^[1-9]\d*$/.test(rawPort)) throw new Error('API_PORT debe ser un entero entre 1 y 65535.');
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port > 65535) throw new Error('API_PORT fuera de rango.');
  validateOrigin(env.PUBLIC_ORIGIN);
  if (env.LOCAL_DEV_AUTH_ENABLED !== 'false') throw new Error('LOCAL_DEV_AUTH_ENABLED debe ser false: todavía no hay sesión.');
  if (env.REGISTRATION_ENABLED !== 'false') throw new Error('REGISTRATION_ENABLED debe ser false: todavía no hay registro.');
  return { host: '127.0.0.1', port };
}
