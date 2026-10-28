import { describe, it, expect } from 'vitest';
import { readAppConfig, readDatabaseUrl } from './config.ts';
const valid = { APP_MODE: 'development', API_HOST: '127.0.0.1', API_PORT: '3000',
 PUBLIC_ORIGIN: 'http://127.0.0.1:5173', REGISTRATION_ENABLED: 'false', LOCAL_DEV_AUTH_ENABLED: 'true',
 DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:15433/meridiano' };
describe('configuración DB/sesión', () => {
 it('admite identidad local explícita', () => {
  expect(readAppConfig(valid).localAuth).toBe(true);
  expect(readAppConfig({ ...valid, LOCAL_DEV_AUTH_ENABLED: 'false' }).localAuth).toBe(false);
 });
 it.each([{ APP_MODE: 'public' }, { API_HOST: '0.0.0.0' }, { API_HOST: '::1' },
  { PUBLIC_ORIGIN: 'http://localhost:5173' }, { PUBLIC_ORIGIN: 'http://127.0.0.1:5173/' },
  { DATABASE_URL: undefined }, { DATABASE_URL: 'postgresql://user@host/db' },
  { DATABASE_URL: 'file:///secret' }, { LOCAL_DEV_AUTH_ENABLED: undefined }
 ])('rechaza configuración insegura: %j', patch => {
  expect(() => readAppConfig({ ...valid, ...patch })).toThrow(/^CONFIG_/);
 });
 it('error redactado', () => {
  expect(() => readDatabaseUrl('https://user:SECRETO_SINTETICO@host/')).toThrow('CONFIG_DATABASE_URL');
 });
});
