import { app, BrowserWindow, ipcMain, protocol, session, shell, systemPreferences } from 'electron';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const origin = 'aura://local';
const entry = `${origin}/`;
const vision = 'node_modules/@mediapipe/tasks-vision';
const routes = new Set([
  'index.html', 'style.css', 'fullscreen.css', 'fonts.css', 'app.js', 'camera.js', 'gesture.js',
  'fullscreen.js', 'overlay.js', 'effects.js', 'moments.js', 'assets/gesto-67.webp',
  'assets/tigre-arco-iris.webp', 'assets/instagram-qr.svg', 'assets/farmou-aura.mp3',
  'assets/pose-landmarker-lite.task', `${vision}/vision_bundle.mjs`,
  ...['barlow-condensed-700', 'barlow-condensed-800', 'dm-sans'].map((font) => `assets/fonts/${font}.woff2`),
  ...['vision_wasm_internal', 'vision_wasm_nosimd_internal'].flatMap((file) => [
    `${vision}/wasm/${file}.js`, `${vision}/wasm/${file}.wasm`,
  ]),
]);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
  '.task': 'application/octet-stream', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
const instagramUrl = 'https://www.instagram.com/israelmartinsai/';
const contentPolicy = [
  "default-src 'none'", "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'", "font-src 'self'",
  "img-src 'self' data:", "media-src 'self'", "connect-src 'self'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([{
  scheme: 'aura', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

function isAppPage(url) {
  return url === origin || url === entry;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1240, height: 920, minWidth: 710, minHeight: 560,
    title: 'Farmador de Aura', backgroundColor: '#13111e', autoHideMenuBar: true,
    ...(process.platform === 'win32' && { icon: join(app.getAppPath(), 'assets/app-icon.ico') }),
    webPreferences: {
      preload: join(app.getAppPath(), 'desktop-preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
    },
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  void window.loadURL(entry);
}

app.whenReady().then(() => {
  protocol.handle('aura', async (request) => {
    const url = new URL(request.url);
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (request.method !== 'GET' || url.host !== 'local' || !routes.has(file)) {
      return new Response(null, { status: 404 });
    }
    try {
      const body = await readFile(join(app.getAppPath(), file));
      return new Response(body, { headers: {
        'Content-Type': mimeTypes[extname(file)],
        'Content-Security-Policy': contentPolicy,
        'Permissions-Policy': 'camera=(self), fullscreen=(), microphone=(), display-capture=()',
        'X-Content-Type-Options': 'nosniff',
      } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });

  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => (
    permission === 'media' && isAppPage(contents?.getURL()) && isAppPage(requestingOrigin) &&
    details.isMainFrame && details.mediaType === 'video'
  ));
  session.defaultSession.setPermissionRequestHandler((contents, permission, reply, details) => {
    const cameraOnly = permission === 'media' &&
      details.mediaTypes?.length === 1 && details.mediaTypes[0] === 'video';
    const allowed = Boolean(isAppPage(contents?.getURL()) && isAppPage(details.requestingUrl) &&
      details.isMainFrame && cameraOnly);
    // macOS delivers no frames until the app asks for camera access itself.
    if (allowed && process.platform === 'darwin') {
      systemPreferences.askForMediaAccess('camera').then(reply, () => reply(false));
    } else reply(allowed);
  });

  ipcMain.handle('camera-fullscreen', (event, enabled) => {
    const frame = event.senderFrame;
    if (!frame || frame.parent || frame.url !== entry || typeof enabled !== 'boolean') return;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (process.platform === 'darwin') window?.setSimpleFullScreen(enabled);
    else window?.setFullScreen(enabled);
  });

  // Only ever opens the fixed Instagram profile, never a URL from the page.
  ipcMain.handle('open-instagram', (event) => {
    if (event.senderFrame?.url === entry) void shell.openExternal(instagramUrl);
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
