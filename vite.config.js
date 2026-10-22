import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The React app calls /api/... and Vite forwards it to the PHP backend.
// Set VITE_API_TARGET in frontend/.env to match how you run the backend:
//   PHP built-in server : http://localhost:8000                         (default)
//   XAMPP (htdocs)      : http://localhost/cuyotech-ssis/backend
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
