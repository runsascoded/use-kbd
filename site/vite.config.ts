import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import rehypeExternalLinks from 'rehype-external-links'

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
    port: 3752,  // hash("use-kbd") into 3000-9999; ≈unique, avoids Vite's 5173 default
    host: true,
    allowedHosts: true,  // accept any Host; trusted-tailnet dev server, reached by bare MagicDNS name (e.g. m3:3752)
  }
})
