const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'dist', 'renderer');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const files = ['index.html', 'styles.css', 'cursor-indicator.html', 'cursor-indicator.css'];
for (const file of files) {
  const src = path.join(__dirname, '..', 'src', 'renderer', file);
  const dest = path.join(outDir, file);
  fs.copyFileSync(src, dest);
}

const mainAssetsOutDir = path.join(__dirname, '..', 'dist', 'main', 'assets');
if (!fs.existsSync(mainAssetsOutDir)) {
  fs.mkdirSync(mainAssetsOutDir, { recursive: true });
}

const mainAssets = ['trayTemplate.svg', 'trayWin.ico'];
for (const file of mainAssets) {
  const src = path.join(__dirname, '..', 'src', 'main', 'assets', file);
  const dest = path.join(mainAssetsOutDir, file);
  fs.copyFileSync(src, dest);
}
