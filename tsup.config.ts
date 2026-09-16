import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // cmdk is an optional peer dep (only <OmnibarCmdk> pulls it) — keep it out of
  // the bundle so consumers who use the hand-rolled <Omnibar> don't pay for it,
  // and so cmdk's React context isn't duplicated.
  external: ['react', 'cmdk'],
})
