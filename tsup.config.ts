
import { defineConfig } from 'tsup'

const FW_EXTERNAL = [
  'react', 'react-dom',
  'vue',
  '@angular/core', '@angular/common',
  'rxjs'
]

export default defineConfig([

  {
    entry: {
      // core
      'index': 'packages/sdk/src/index.ts',
      // adapters
      'adapters/react': 'packages/sdk/src/adapters/react.ts',
      'adapters/vue': 'packages/sdk/src/adapters/vue.ts',
      'adapters/angular': 'packages/sdk/src/adapters/angular.ts',
      // ui
      'ui/index': 'packages/sdk/src/ui/index.ts',
      // embed as a module (keep only if you export "./embed")
      'embed/index': 'packages/sdk/src/embed.ts'
    },
    outDir: 'packages/sdk/dist',
    format: ['esm', 'cjs'],
    dts: true,
    target: 'es2022',
    platform: 'neutral',
    splitting: false,   // stable filenames (no hashed chunks)
    sourcemap: false,   // keep tarball clean
    minify: true,
    treeshake: true,
    clean: true,
    external: FW_EXTERNAL
  },

  // ───────────────────────────────────────────────────────────
  // CDN IIFE (script tag) — NOT exported via "exports"
  // → packages/sdk/dist/cdn/axonstream.js
  // ───────────────────────────────────────────────────────────
  {
    entry: { axonstream: 'packages/sdk/src/cdn.ts' },
    outDir: 'packages/sdk/dist/cdn',
    format: ['iife'],
    dts: false,
    globalName: 'AxonStream',
    platform: 'browser',
    target: 'es2020',
    splitting: false,
    sourcemap: false,
    minify: true,
    treeshake: true,
    clean: false
  },

  // ───────────────────────────────────────────────────────────
  // React Hooks → packages/react-hooks/dist
  // ───────────────────────────────────────────────────────────
  {
    entry: { index: 'packages/react-hooks/src/index.ts' },
    outDir: 'packages/react-hooks/dist',
    format: ['esm', 'cjs'],
    dts: true,
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    sourcemap: false,
    minify: true,
    treeshake: true,
    clean: true,
    external: ['react', 'react-dom', '@axonstream/core'],
    tsconfig: 'packages/react-hooks/tsconfig.json'
  },

  // ───────────────────────────────────────────────────────────
  // CLI (Node) → packages/cli/dist/cli.cjs
  // ───────────────────────────────────────────────────────────
  {
    entry: { cli: 'packages/cli/src/cli.ts' },
    outDir: 'packages/cli/dist',
    format: ['cjs'],
    dts: false,                     // CLIs don't ship .d.ts
    target: 'node18',
    platform: 'node',
    splitting: false,
    sourcemap: false,
    minify: false,
    clean: true,
    shims: true,
    banner: { js: '#!/usr/bin/env node' },
    outExtension: () => ({ js: '.cjs' }),
    external: ['@axonstream/core', 'commander', 'chalk', 'dotenv', 'jwt-decode']
  }
])
