import { defineConfig } from 'vite';

// base relativa: funciona em qualquer subdiretório (ex.: GitHub Pages /<repo>/).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
});
