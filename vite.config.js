import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mapping: ['leaflet', 'react-leaflet', 'react-leaflet-draw', 'leaflet-draw'],
          database: ['@supabase/supabase-js'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
});