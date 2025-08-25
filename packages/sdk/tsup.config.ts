import { defineConfig } from 'tsup'

export default defineConfig([
    // Core SDK build
    {
        entry: ['src/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        outDir: 'dist',
        clean: true,
        sourcemap: true,
        minify: false,
        splitting: true,
        treeshake: true,
        external: ['react', 'vue', '@angular/core'],
    },

    // Framework Adapters
    {
        entry: [
            'src/adapters/react.ts',
            'src/adapters/vue.ts',
            'src/adapters/angular.ts'
        ],
        format: ['esm', 'cjs'],
        dts: true,
        outDir: 'dist/adapters',
        clean: false,
        sourcemap: true,
        external: ['react', 'vue', '@angular/core'],
    },

    // UI Components
    {
        entry: ['src/ui/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        outDir: 'dist/ui',
        clean: false,
        sourcemap: true,
        external: ['react', 'vue', '@angular/core'],
    },

    // CDN Build (minified for browsers)
    {
        entry: ['src/cdn.ts'],
        format: ['iife'],
        globalName: 'AxonStream',
        outDir: 'dist',
        clean: false,
        minify: true,
        sourcemap: false,
        outExtension: () => ({ js: '.min.js' }),
    },

    // Embed Helper
    {
        entry: ['src/embed.ts'],
        format: ['esm', 'cjs'],
        outDir: 'dist',
        clean: false,
        minify: true,
    },
])
