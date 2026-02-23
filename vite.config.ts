import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/noaa-api': {
        target: 'https://hdsc.nws.noaa.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/noaa-api/, ''),
        secure: false,
      },
      '/contour-api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/contour-api/, ''),
      },
    },
  },
})
