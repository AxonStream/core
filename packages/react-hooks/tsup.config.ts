// packages/react-hooks/tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { index: 'src/index.ts' },   // stable file name
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,                          // emit .d.ts for consumers
  target: 'es2022',
  platform: 'neutral',
  splitting: false,                   // avoid hashed chunk names
  sourcemap: false,                   // keep tarball slim
  minify: true,
  treeshake: true,
  clean: true,
  external: ['react', 'react-dom', '@axonstream/core'],
  tsconfig: './tsconfig.json'
})
