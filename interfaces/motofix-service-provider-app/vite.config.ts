import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

const logger = createLogger();
const _err = logger.error.bind(logger);
logger.error = (msg, opts) => {
  if (opts?.error?.code === 'ECONNRESET') return;
  if (msg.includes('ECONNRESET')) return;
  _err(msg, opts);
};

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 8084,
    https: {
      cert: '../motofix-driver-app/cert.pem',
      key:  '../motofix-driver-app/cert-key.pem',
    },
    proxy: {
      '/auth':          { target: 'http://localhost:8000', changeOrigin: true },
      '/providers':     { target: 'http://localhost:8000', changeOrigin: true },
      '/mechanics':     { target: 'http://localhost:8002', changeOrigin: true },
      '/requests':      { target: 'http://localhost:8001', changeOrigin: true },
      '/ws': {
        target: 'ws://localhost:8001', ws: true, changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'ECONNRESET') return // browser closed the tab/refreshed — harmless
            console.error('[ws proxy]', err.message)
          })
        },
      },
      '/subscriptions': { target: 'http://localhost:8005', changeOrigin: true },
    },
  },
})
