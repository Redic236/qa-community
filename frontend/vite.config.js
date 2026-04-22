import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    plugins: [react()],
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
