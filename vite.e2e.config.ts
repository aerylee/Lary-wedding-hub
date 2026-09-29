// Local smoke-testing only: serve the app against a bare PostgREST (no Docker).
import { mergeConfig } from 'vite';
import base from './vite.config';
export default mergeConfig(base, {
  server: { port: 5173, strictPort: true, proxy: { '/rest/v1': { target: 'http://localhost:3000', rewrite: (p: string) => p.replace(/^\/rest\/v1/, '') } } },
});
