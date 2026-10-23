import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/msg91': {
        target: 'https://control.msg91.com/api/v5',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/msg91/, '')
      }
    }
  }
})
