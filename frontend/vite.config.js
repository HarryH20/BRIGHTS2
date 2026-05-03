import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':   ['@tanstack/react-query'],
          'vendor-echarts': ['echarts', 'echarts-for-react', 'echarts-wordcloud'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:5000',
      '/api':  'http://localhost:5000',
    },
  },
})
