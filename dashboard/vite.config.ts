import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/auth/magic-link': 'http://localhost:3000',
      '/auth/login': 'http://localhost:3000',
      '/auth/reset-password': 'http://localhost:3000',
      '/auth/set-password': 'http://localhost:3000',
      '/auth/verify': 'http://localhost:3000',
      '/restaurants': 'http://localhost:3000',
      '/demo': 'http://localhost:3000',
      '/jobs': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/whatsapp': 'http://localhost:3000',
      '/billing': 'http://localhost:3000',
      '/webhooks': 'http://localhost:3000',
    },
  },
})
