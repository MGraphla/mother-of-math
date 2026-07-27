import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001/mothe-of-math/us-central1',
        changeOrigin: true,
      },
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        // Only register the service worker in dev when needed; production builds always emit SW.
        enabled: mode === 'development',
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp}'],
        navigateFallback: '/index.html',
        // Don't serve the SPA shell for missing static files (MIME errors on hashed chunks).
        navigateFallbackDenylist: [/^\/api/, /^\/assets\//],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Mama Math - Mathematics Education',
        short_name: 'Mama Math',
        description: 'AI-powered mathematics education for teachers and students in Africa.',
        theme_color: '#047857',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
