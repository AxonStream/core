import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: false,  // Temporarily disable DTS until monorepo type resolution is fixed
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    minify: false,
    splitting: true,
    external: ['react', '@axonstream/core'],
    tsconfig: './tsconfig.json', // Use our custom tsconfig with path mapping
})
