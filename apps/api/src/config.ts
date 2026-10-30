export interface BootstrapConfig { host: '127.0.0.1'; port: number }
export interface AppConfig extends BootstrapConfig {
  origin: string; localAuth: boolean; databaseUrl: string;
  aiProvider: 'ollama' | 'mock' | 'none';
  aiBaseUrl?: string;
  aiModel?: string;
  aiTimeoutMs?: number;
}
function validateOrigin(value: string | undefined): string {
  if (!value) throw new Error('CONFIG_PUBLIC_ORIGIN');
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.origin !== value) throw new Error();
    return value;
  } catch { throw new Error('CONFIG_PUBLIC_ORIGIN'); }
}
function readHttp(env: NodeJS.ProcessEnv): BootstrapConfig {
  if (env.APP_MODE !== 'development') throw new Error('CONFIG_APP_MODE');
  if (env.API_HOST !== '127.0.0.1') throw new Error('CONFIG_API_HOST');
  const port = Number(env.API_PORT);
  if (!env.API_PORT || !/^[1-9]\d*$/.test(env.API_PORT) || !Number.isSafeInteger(port) || port > 65535) throw new Error('CONFIG_API_PORT');
  validateOrigin(env.PUBLIC_ORIGIN);
  if (env.REGISTRATION_ENABLED !== 'false') throw new Error('CONFIG_REGISTRATION_ENABLED');
  return { host: '127.0.0.1', port };
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
  return http;
}
export function readAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const http = readHttp(env);
  if (!['true', 'false'].includes(env.LOCAL_DEV_AUTH_ENABLED ?? '')) throw new Error('CONFIG_LOCAL_DEV_AUTH_ENABLED');
  const aiProvider = env.AI_PROVIDER ?? 'mock';
  if (!['ollama', 'mock', 'none'].includes(aiProvider)) throw new Error('CONFIG_AI_PROVIDER');
const cfg: AppConfig = {
    ...http, origin: validateOrigin(env.PUBLIC_ORIGIN), localAuth: env.LOCAL_DEV_AUTH_ENABLED === 'true',
    databaseUrl: readDatabaseUrl(env.DATABASE_URL),
    aiProvider: aiProvider as AppConfig['aiProvider'],
  };
  if (env.AI_BASE_URL) cfg.aiBaseUrl = env.AI_BASE_URL;
  if (env.AI_MODEL) cfg.aiModel = env.AI_MODEL;
  if (env.AI_TIMEOUT_MS) cfg.aiTimeoutMs = Number(env.AI_TIMEOUT_MS);
  return cfg;
}
