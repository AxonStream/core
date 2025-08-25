import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/cli.ts'],
    format: ['cjs'],
    dts: true,
    outDir: 'dist',
    clean: true,
    target: 'node16',
    sourcemap: true,
    shims: true,
    external: ['@axonstream/core', 'commander', 'chalk', 'dotenv', 'jwt-decode'],
})
