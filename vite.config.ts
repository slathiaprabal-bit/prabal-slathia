import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Desktop (Electron) build: relative asset paths so the bundle loads over
  // file://, and a separate outDir so the web `dist/` stays untouched.
  const desktop = mode === 'desktop';
  return {
    base: desktop ? './' : '/',
    build: desktop ? {outDir: 'dist-desktop'} : undefined,
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        // Prevent backend CSV writes from triggering full-page HMR reloads.
        ignored: ['**/quant_engine/data/**', '**/__pycache__/**', '**/qt_errors.log'],
      },
    },
  };
});
