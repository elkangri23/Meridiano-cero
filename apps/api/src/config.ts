export interface BootstrapConfig { host: '127.0.0.1' | '0.0.0.0'; port: number }
export interface AppConfig extends BootstrapConfig {
  mode: 'development' | 'production';
  origin: string; localAuth: boolean; registrationEnabled: boolean; databaseUrl: string;
  aiProvider: 'ollama' | 'mock' | 'none' | 'freellmapi' | 'openai' | 'anthropic' | 'google' | 'openai-compatible';
  aiBaseUrl?: string;
  aiModel?: string;
  aiApiKey?: string;
  aiTimeoutMs?: number;
}
const PRODUCTION_ORIGIN = 'https://meridianocero.laurafernandezenfermeria.com';
function validateOrigin(value: string | undefined, mode: 'development' | 'production'): string {
  if (!value) throw new Error('CONFIG_PUBLIC_ORIGIN');
  try {
    const url = new URL(value);
    if (mode === 'production') {
      if (url.protocol !== 'https:' || url.origin !== PRODUCTION_ORIGIN || url.origin !== value) throw new Error();
    } else if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== value) throw new Error();
    return value;
  } catch { throw new Error('CONFIG_PUBLIC_ORIGIN'); }
}
function readDevelopmentRegistration(env: NodeJS.ProcessEnv): boolean {
  // En desarrollo el registro también puede activarse (REGISTRATION_ENABLED=true)
  // para probar la UI de autenticación contra la API local: el desarrollo solo
  // escucha en loopback y ya ofrece sesión local sin contraseña, así que no se
  // amplía la superficie de confianza. El .env de desarrollo lo deja en false
  // por defecto, así que el comportamiento habitual no cambia.
  if (env.REGISTRATION_ENABLED !== 'false' && env.REGISTRATION_ENABLED !== 'true') throw new Error('CONFIG_REGISTRATION_ENABLED');
  return env.REGISTRATION_ENABLED === 'true';
}
function readHttp(env: NodeJS.ProcessEnv): BootstrapConfig & { mode: 'development' | 'production'; origin: string; registrationEnabled: boolean } {
  const mode = env.APP_MODE;
  if (mode !== 'development' && mode !== 'production') throw new Error('CONFIG_APP_MODE');
  // En desarrollo la API solo escucha en el loopback del host. En producción
  // corre en contenedor: el loopback del contenedor no es el del host, y el
  // puerto publicado (127.0.0.1:3000) es lo que la mantiene solo-local; por
  // eso ahí se admite 0.0.0.0 dentro de la red aislada del compose. Cualquier
  // otra IP se rechaza en ambos modos.
  if (mode === 'development') {
    if (env.API_HOST !== '127.0.0.1') throw new Error('CONFIG_API_HOST');
  } else if (env.API_HOST !== '127.0.0.1' && env.API_HOST !== '0.0.0.0') throw new Error('CONFIG_API_HOST');
  const host = env.API_HOST as '127.0.0.1' | '0.0.0.0';
  const port = Number(env.API_PORT);
  if (!env.API_PORT || !/^[1-9]\d*$/.test(env.API_PORT) || !Number.isSafeInteger(port) || port > 65535) throw new Error('CONFIG_API_PORT');
  const origin = validateOrigin(env.PUBLIC_ORIGIN, mode);
  if (mode === 'production') {
    if (env.REGISTRATION_ENABLED !== 'true') throw new Error('CONFIG_REGISTRATION_ENABLED');
    return { host, port, mode, origin, registrationEnabled: true };
  }
  return { host, port, mode, origin, registrationEnabled: readDevelopmentRegistration(env) };
}
export function readDatabaseUrl(value: string | undefined): string {
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.password || !url.pathname.slice(1) || url.hash) throw new Error();
    return value;
  } catch { throw new Error('CONFIG_DATABASE_URL'); }
}
/** Bootstrap without identity, retained for isolated HTTP tests. */
export function readBootstrapConfig(env: NodeJS.ProcessEnv): BootstrapConfig {
  const http = readHttp(env);
  if (env.LOCAL_DEV_AUTH_ENABLED !== 'false') throw new Error('CONFIG_LOCAL_DEV_AUTH_ENABLED');
  return { host: http.host, port: http.port };
}
export function readAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const http = readHttp(env);
  if (!['true', 'false'].includes(env.LOCAL_DEV_AUTH_ENABLED ?? '')) throw new Error('CONFIG_LOCAL_DEV_AUTH_ENABLED');
  // Fail-closed: en producción no existe sesión local de desarrollo.
  if (http.mode === 'production' && env.LOCAL_DEV_AUTH_ENABLED !== 'false') throw new Error('CONFIG_LOCAL_DEV_AUTH_ENABLED');
  const aiProvider = env.AI_PROVIDER ?? 'mock';
  if (!['ollama', 'mock', 'none', 'freellmapi', 'openai', 'anthropic', 'google', 'openai-compatible'].includes(aiProvider)) throw new Error('CONFIG_AI_PROVIDER');
  const cfg: AppConfig = {
    ...http, localAuth: env.LOCAL_DEV_AUTH_ENABLED === 'true',
    databaseUrl: readDatabaseUrl(env.DATABASE_URL),
    aiProvider: aiProvider as AppConfig['aiProvider'],
  };
  return { ...cfg, ...readAiSettings(env, cfg.aiProvider) };
}

function readAiSettings(env: NodeJS.ProcessEnv, aiProvider: AppConfig['aiProvider']): Pick<AppConfig, 'aiBaseUrl' | 'aiModel' | 'aiApiKey' | 'aiTimeoutMs'> {
  const settings: Pick<AppConfig, 'aiBaseUrl' | 'aiModel' | 'aiApiKey' | 'aiTimeoutMs'> = {};
  if (env.AI_BASE_URL) settings.aiBaseUrl = env.AI_BASE_URL;
  if (env.AI_MODEL) settings.aiModel = env.AI_MODEL;
  // Fail-closed: los proveedores con clave no arrancan sin ella; sin clave
  // no se cae silenciosamente al mock (en producción el defecto es real).
  if (['freellmapi', 'openai', 'anthropic', 'google'].includes(aiProvider)) {
    if (!env.AI_API_KEY) throw new Error('CONFIG_AI_API_KEY');
    settings.aiApiKey = env.AI_API_KEY;
  } else if (env.AI_API_KEY) {
    settings.aiApiKey = env.AI_API_KEY;
  }
  if (env.AI_TIMEOUT_MS) settings.aiTimeoutMs = Number(env.AI_TIMEOUT_MS);
  return settings;
}
