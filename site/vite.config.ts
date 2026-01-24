import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import rehypeExternalLinks from 'rehype-external-links'

const allowedHosts = process.env.VITE_ALLOWED_HOSTS?.split(',') ?? []

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        rehypePlugins: [
          [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }],
        ],
      }),
    },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    ...(allowedHosts.length > 0 && { allowedHosts }),
  }
})
