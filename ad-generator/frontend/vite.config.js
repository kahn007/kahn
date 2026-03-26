import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves from /kahn/ad-generator/ (repo name + target-folder)
  base: process.env.NODE_ENV === 'production' ? '/kahn/ad-generator/' : '/',
  server: {
    port: 3000,
  },
})
