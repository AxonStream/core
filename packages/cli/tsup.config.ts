import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  outDir: 'dist',
  format: ['cjs'],
  platform: 'node',
  target: 'node18',
  splitting: false,
  sourcemap: false,
  minify: false,
  clean: true,
  shims: true,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
  outExtension: () => ({ js: '.cjs' }),
  external: ['@axonstream/core', 'commander', 'chalk', 'dotenv', 'jwt-decode']
})
