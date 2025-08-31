import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    // Main SDK entry point
    index: 'src/index.ts',

    // Framework-specific entry points
    react: 'src/adapters/react.ts',
    vue: 'src/adapters/vue.ts',
    angular: 'src/adapters/angular.ts',
    svelte: 'src/adapters/svelte.ts',

    // Magic collaboration modules
    magic: 'src/magic/magic-collaboration.ts',
    'magic-time-travel': 'src/magic/magic-time-travel.ts',
    'magic-presence': 'src/magic/magic-presence.ts',

    // Framework detection and universal adapter
    'framework-detector': 'src/framework/framework-detector.ts',
    'universal-adapter': 'src/framework/universal-adapter.ts',

    // Configuration and utilities
    config: 'src/config/default-config.ts',
    utils: 'src/utils/helpers.ts',

    // Types and constants
    types: 'src/types/schemas.ts',
    constants: 'src/types/constants.ts',

    // CDN build
    cdn: 'src/cdn.ts',
  },

  outDir: 'dist',
  format: ['esm', 'cjs'],
  platform: 'browser',
  target: 'es2020',
  splitting: false,
  sourcemap: true,
  minify: true,
  clean: true,
  shims: true,
  dts: true,

  // Banner for CDN build
  banner: {
    js: '/* 🚀 AXONSTREAM CORE SDK v2.0.0 - The most advanced real-time collaboration platform */',
  },

  // External dependencies
  external: [
    'react',
    'vue',
    '@angular/core',
    '@angular/common',
    'rxjs',
    'svelte',
    'socket.io-client',
    'redis',
    'zod',
    'uuid',
    'eventemitter2'
  ],

  // Bundle configuration
  bundle: true,
  treeshake: true,

  // Output file names
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.js',
      dts: '.d.ts'
    };
  },

  // Environment variables
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
  },

  // Build hooks
  onSuccess: 'echo "✅ SDK built successfully!"',
  onFailure: 'echo "❌ SDK build failed!"',

  // Watch mode configuration
  watch: process.env.NODE_ENV === 'development',

  // Metafile for bundle analysis
  metafile: process.env.ANALYZE === 'true',
});
