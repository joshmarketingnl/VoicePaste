#!/usr/bin/env node
/**
 * Renders build/icon.svg to all app icon formats:
 *   build/icon.png   (512, used by electron-builder for Linux/mac fallback)
 *   build/icon.ico   (Windows: 16..256 multi-resolution)
 *   build/icons/*.png (intermediate sizes; also used to build the .icns)
 * The .icns itself is written by scripts/generate-icons.py (Pillow).
 *
 * Usage: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(repoRoot, 'build', 'icon.svg');
const outDir = path.join(repoRoot, 'build', 'icons');
mkdirSync(outDir, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
for (const size of sizes) {
  await sharp(svg, { density: (72 * size) / 1024 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, `icon-${size}.png`));
  console.log(`icon-${size}.png`);
}
await sharp(svg, { density: 36 }).resize(512, 512).png().toFile(path.join(repoRoot, 'build', 'icon.png'));
console.log('build/icon.png');
