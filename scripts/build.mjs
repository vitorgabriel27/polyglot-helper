import { build as bundle } from 'esbuild';
import { build as buildUI } from 'vite';
import { rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await bundle({
  entryPoints: { main: 'src/desktop/main.ts', preload: 'src/desktop/preload.ts' },
  outdir: 'dist/desktop', outExtension: { '.js': '.cjs' },
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  external: ['electron'], sourcemap: true,
});
await buildUI({
  configFile: false, root: 'src/renderer', base: './',
  build: { outDir: '../../dist/renderer', emptyOutDir: false },
});
