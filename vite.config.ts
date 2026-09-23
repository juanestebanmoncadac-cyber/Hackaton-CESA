import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`       → carpeta dist/ normal (Vercel)
// `npm run build:demo`  → un solo index.html autocontenido (para compartir la demo)
export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'demo' ? { outDir: 'dist-demo' } : {},
  test: { include: ['src/**/*.test.ts'] },
}))
