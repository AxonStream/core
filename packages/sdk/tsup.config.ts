import { defineConfig } from 'tsup'

export default defineConfig([
  // Library + adapters + ui (stable filenames, d.ts)
  {
    entry: {
      index: 'src/index.ts',
      'adapters/react': 'src/adapters/react.ts',
      'adapters/vue': 'src/adapters/vue.ts',
      'adapters/angular': 'src/adapters/angular.ts',
      'ui/index': 'src/ui/index.ts',
      'embed/index': 'src/embed.ts'
    },
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    target: 'es2022',
    platform: 'neutral',
    splitting: false,
    sourcemap: false,
    minify: false,
    treeshake: true,
    clean: true,
    external: [
      'react', 'react-dom',
      'vue',
      '@angular/core', '@angular/common',
      'rxjs'
    ]
  },

  // CDN global (script tag), NOT exported via imports
  {
    entry: { axonstream: 'src/cdn.ts' },
    outDir: 'dist/cdn',
    format: ['iife'],
    dts: false,
    globalName: 'AxonStream',
    target: 'es2020',
    platform: 'browser',
    sourcemap: false,
    minify: false,
    treeshake: true,
    clean: false
  }
])
