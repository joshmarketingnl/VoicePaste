import path from 'path';
import { nativeImage } from 'electron';

function createFallbackTrayIcon(fill: string, background = 'transparent') {
  const svg = `
  <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="10" fill="${background}" />
    <path
      fill="${fill}"
      d="M16 5.5a5.5 5.5 0 0 0-5.5 5.5v3.44a5.5 5.5 0 0 0 11 0V11A5.5 5.5 0 0 0 16 5.5Zm1.03 17.28V24.5h2.75a1.03 1.03 0 1 1 0 2.06h-7.56a1.03 1.03 0 1 1 0-2.06h2.75v-1.72a8.15 8.15 0 0 1-6.74-8.03 1.03 1.03 0 0 1 2.06 0 6.09 6.09 0 0 0 12.19 0 1.03 1.03 0 1 1 2.06 0 8.14 8.14 0 0 1-6.71 8.03Z"
    />
  </svg>
  `;
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return nativeImage.createFromDataURL(dataUrl);
}

export function createTrayIcon() {
  if (process.platform === 'win32') {
    const iconPath = path.join(__dirname, 'assets', 'trayWin.ico');
    const image = nativeImage.createFromPath(iconPath);
    const trayIcon = image.isEmpty()
      ? createFallbackTrayIcon('#0f172a', '#fbbf24').resize({ width: 32, height: 32 })
      : image;
    return trayIcon;
  }

  const iconPath = path.join(__dirname, 'assets', 'trayTemplate.svg');
  const image = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  const trayIcon = image.isEmpty()
    ? createFallbackTrayIcon('black').resize({ width: 18, height: 18 })
    : image;
  trayIcon.setTemplateImage(true);
  return trayIcon;
}
