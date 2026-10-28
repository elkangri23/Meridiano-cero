import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname + '/../..', 'API_');
  const port = Number(env.API_PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT no válida para el proxy.');
  return {
    server: { port: 5173, host: '127.0.0.1', strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${port}`, changeOrigin: false } } },
    preview: { host: '127.0.0.1', strictPort: true },
  };
});
