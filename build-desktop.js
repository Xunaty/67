import { packager } from '@electron/packager';

const platform = process.argv[2] ?? process.platform;
if (!['darwin', 'win32'].includes(platform)) throw new Error('Escolha darwin ou win32.');

const mac = platform === 'darwin';
const bundledPaths = [
  '/package.json', '/desktop.js', '/desktop-preload.cjs', '/index.html', '/style.css', '/fullscreen.css',
  '/app.js', '/camera.js', '/gesture.js', '/overlay.js', '/fullscreen.js', '/assets',
  '/node_modules/@mediapipe/tasks-vision',
];

const [output] = await packager({
  dir: '.', out: 'dist', platform, arch: mac ? process.arch : 'x64',
  name: 'Farmador de Aura', appBundleId: 'br.com.auraarcade.farmador',
  icon: mac ? 'assets/app-icon.icns' : 'assets/app-icon.ico',
  asar: true, prune: false, overwrite: true,
  ignore: (path) => Boolean(path) && !bundledPaths.some((entry) =>
    path === entry || path.startsWith(`${entry}/`) || entry.startsWith(`${path}/`)),
  ...(mac ? {
    appCategoryType: 'public.app-category.games',
    usageDescription: { Camera: 'A câmera detecta os movimentos dos braços para contar aura.' },
    osxSign: {
      identity: '-', identityValidation: false, preAutoEntitlements: false,
      preEmbedProvisioningProfile: false, continueOnError: false,
      optionsForFile: () => ({ hardenedRuntime: false, timestamp: 'none' }),
    },
  } : {}),
});
console.log(`App gerado em ${output}`);
