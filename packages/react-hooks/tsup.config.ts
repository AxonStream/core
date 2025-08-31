// packages/react-hooks/tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2022',
  platform: 'neutral',
  splitting: false,
  sourcemap: false,
  minify: true,
  treeshake: true,
  clean: true,
  external: ['react', 'react-dom', '@axonstream/core', 'socket.io-client', 'ws', 'crypto', 'fs', 'http', 'https', 'net', 'tls', 'url', 'stream', 'zlib', 'child_process'],
  tsconfig: './tsconfig.json'
})
