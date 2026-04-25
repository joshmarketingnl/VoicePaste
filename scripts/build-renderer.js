const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'dist', 'renderer');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

Promise.all([
  esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'src', 'renderer', 'renderer.ts')],
    bundle: true,
    outfile: path.join(outDir, 'renderer.js'),
    platform: 'browser',
    format: 'iife',
    target: ['chrome105'],
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'src', 'renderer', 'cursor-indicator.ts')],
    bundle: true,
    outfile: path.join(outDir, 'cursor-indicator.js'),
    platform: 'browser',
    format: 'iife',
    target: ['chrome105'],
    sourcemap: true,
  }),
]).catch((error) => {
  console.error(error);
  process.exit(1);
});
