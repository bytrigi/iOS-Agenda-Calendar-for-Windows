import { ipcRenderer, contextBridge } from 'electron'

// --- AÑADE ESTO ---
console.log('✅ PRELOAD CARGADO CORRECTAMENTE');
// ------------------

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-min'),
  maximize: () => ipcRenderer.send('window-max'),
  close: () => ipcRenderer.send('window-close'),
  // Nuevo método de proxy
  icloudRequest: (config: any) => ipcRenderer.invoke('icloud-request', config)
})