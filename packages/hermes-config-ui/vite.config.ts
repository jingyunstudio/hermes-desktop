import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5174,
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist/public'
  }
})
