import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { 
    index: 'src/index.ts',
    cli: 'src/cli.ts' 
  },
  outDir: 'dist',
  format: ['cjs'],
  platform: 'node',
  target: 'node18',
  splitting: false,
  sourcemap: false,
  minify: false,
  clean: true,
  shims: true,
  dts: true,
  banner: { js: '#!/usr/bin/env node' },
  outExtension: () => ({ js: '.js' }),
  external: ['@axonstream/core', 'commander', 'chalk', 'dotenv', 'jwt-decode']
})
