import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    // Service worker: pre-caches all hashed chunks at install time + serves
    // them cache-first on repeat visits → second visit is ~0 network.
    // Auto-updates when a new build lands: the new SW takes over and reloads.
    // Dev mode is disabled by default so Playwright / hot-reload aren't
    // touched by stale precache.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: '问答社区',
        short_name: 'Q&A',
        description: '提问、回答、点赞、采纳，积分和徽章激励贡献',
        theme_color: '#1677ff',
        background_color: '#f5f6f8',
        display: 'standalone',
        lang: 'zh-CN',
        start_url: '/',
      },
      workbox: {
        // Match the chunks emitted by manualChunks; .json only matters if we
        // start serving static data — harmless either way.
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        // Fall back to SPA index for client-route deep links when offline.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Split vendor bundles so:
    //   - first visit: user downloads react / antd / redux / i18n chunks
    //     in parallel → faster than one giant 1.8MB blob
    //   - repeat visits: app code changes don't invalidate the 3rd-party
    //     chunks → browser cache hit on everything in node_modules
    //   - recharts only loads when admin hits the dashboard (lazy route below)
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Separate chunks so we can observe icon tree-shaking in the
          // final sizes AND let the browser cache antd core independently
          // of icon additions during iteration.
          'antd-vendor': ['antd'],
          'icons-vendor': ['@ant-design/icons'],
          'charts-vendor': ['recharts'],
          'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'i18n-vendor': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
    // Bump the warning limit — per-chunk is what matters now, and the vendor
    // chunks are intentionally in the 300-500 KB range.
    chunkSizeWarningLimit: 600,
  },
});
