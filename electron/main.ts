import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// const require = createRequire(import.meta.url) // Removed unused require
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// SILENCE ELECTRON SECURITY WARNINGS IN DEV (Vite requires unsafe-eval)
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

app.disableHardwareAcceleration() 

if (process.platform === 'win32') {
  app.setAppUserModelId('com.ioscalendar.windows')
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    transparent: true, 
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC, 'logo.png'),
    webPreferences: {
      preload: path.join(process.env.APP_ROOT, 'dist-electron', 'preload.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: true 
    }
  })

  win.on('ready-to-show', () => {
    win?.show()
  })

  // ========================================================
  // 🛡️ SEGURIDAD EN PRODUCCIÓN: Bloquear DevTools
  // ========================================================
  win.webContents.on('before-input-event', (event, input) => {
    // Si NO estamos en desarrollo, bloqueamos F12 y Ctrl+Shift+I
    if (!VITE_DEV_SERVER_URL) {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        event.preventDefault();
      }
    }
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ========================================================
// 🚦 CONTROL DE VENTANA - FUERZA BRUTA
// ========================================================

ipcMain.on('window-min', () => {
  win?.minimize();
});

ipcMain.on('window-max', () => {
  if (win) {
    // 1. OBTENER ESTADO ACTUAL
    const isMaximizedState = win.isMaximized();
    
    // 2. OBTENER TAMAÑOS REALES (Por si isMaximized miente)
    const { width: currentW, height: currentH } = win.getBounds();
    const currentDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { width: screenW, height: screenH } = currentDisplay.workArea;

    // Si ocupa casi toda la pantalla (margen 50px), asumimos que está MAXIMIZADA
    const isVisuallyMaximized = currentW >= (screenW - 50) && currentH >= (screenH - 50);

    // 3. DECISIÓN: Si está maximizada (oficial o visualmente) -> RESTAURAR
    if (isMaximizedState || isVisuallyMaximized) {
      console.log('📉 Acción: FORZAR RESTAURACIÓN');
      
      // Intentamos el método suave
      win.unmaximize();
      
      // ⚠️ TRUCO DE FUERZA BRUTA:
      // Si después de un milisegundo sigue siendo gigante, forzamos el tamaño
      const { width: checkW } = win.getBounds();
      if (checkW >= (screenW - 50)) {
         win.setBounds({ width: 1200, height: 800 }); // Tamaño original forzado
         win.center(); // La centramos para que no quede rara
      }
      
    } else {
      console.log('📈 Acción: MAXIMIZAR');
      win.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  win?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})


// ========================================================
// ☁️ ICLOUD PROXY (Bypass CORS)
// ========================================================
import axios from 'axios';

ipcMain.handle('icloud-request', async (_event, { method, url, data, headers, auth }) => {
  try {
    const response = await axios({
      method,
      url,
      data,
      headers,
      auth,
      // IMPORTANTE: Axios en Node sigue redirecciones por defecto, pero
      // CalDAV a veces necesita manejo especial. Por ahora default está bien.
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error: any) {
    console.error('Proxy Error:', error.message);
    return { 
      success: false, 
      error: error.message, 
      status: error.response?.status,
      data: error.response?.data 
    };
  }
});

app.whenReady().then(createWindow)
