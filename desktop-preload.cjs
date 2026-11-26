const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('auraDesktop', {
  setCameraFullscreen: (enabled) => ipcRenderer.invoke('camera-fullscreen', enabled),
});
