import { defineConfig } from 'tsup'

export default defineConfig([
    // Core SDK build
    {
        entry: ['packages/sdk/src/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        outDir: 'packages/sdk/dist',
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
            'packages/sdk/src/adapters/react.ts',
            'packages/sdk/src/adapters/vue.ts',
            'packages/sdk/src/adapters/angular.ts'
        ],
        format: ['esm', 'cjs'],
        dts: true,
        outDir: 'packages/sdk/dist/adapters',
        clean: false,
        sourcemap: true,
        external: ['react', 'vue', '@angular/core'],
    },

    // UI Components
    {
        entry: ['packages/sdk/src/ui/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        outDir: 'packages/sdk/dist/ui',
        clean: false,
        sourcemap: true,
    },

    // CDN Build (minified for browsers)
    {
        entry: ['packages/sdk/src/cdn.ts'],
        format: ['iife'],
        globalName: 'AxonStream',
        outDir: 'packages/sdk/dist',
        clean: false,
        minify: true,
        sourcemap: false,
        outExtension: () => ({ js: '.min.js' }),
    },

    // Embed Helper
    {
        entry: ['packages/sdk/src/embed.ts'],
        format: ['esm', 'cjs'],
        outDir: 'packages/sdk/dist',
        clean: false,
        minify: true,
    },

    // React Hooks Package
    {
        entry: ['packages/react-hooks/src/index.ts'],
        format: ['esm', 'cjs'],
        dts: true,
        outDir: 'packages/react-hooks/dist',
        clean: true,
        sourcemap: true,
        external: ['react'],
        // Build react-hooks after SDK is built
        onSuccess: 'echo "React hooks built successfully"',
    },

    // CLI Package
    {
        entry: ['packages/cli/src/cli.ts'],
        format: ['cjs'],
        dts: true,
        outDir: 'packages/cli/dist',
        clean: true,
        target: 'node16',
        sourcemap: true,
        shims: true,
        external: ['@axonstream/core'],
    }
])
