import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite uses Rollup for production builds, so manualChunks here is
// literally Rollup's chunking API (spec §55 asks for "manual Rollup
// chunk segmentations"). Splits mapping, layout, and database/client
// code into separate cacheable bundles so a change to one doesn't
// invalidate the browser cache for the others.
export default defineConfig({
  plugins: [react()],
  server: {
    // Explicit IPv4 binding. Left ambiguous, Vite/Node can end up bound
    // only to the IPv6 loopback ([::1]) while some browsers/Windows
    // configs resolve "localhost" to IPv4 (127.0.0.1) — the two never
    // meet, producing inconsistent connection-refused/404 behavior
    // depending on which address wins resolution at that moment.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true, // fail loudly instead of silently trying 5174, 5175...
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
