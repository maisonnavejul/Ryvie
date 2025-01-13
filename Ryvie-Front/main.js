const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-software-rasterizer');

process.env.NODE_ENV = 'development';

let mainWindow;
let udpProcess; // Processus enfant pour WebSocket
let lastKnownServerIP = null; // Stocker la dernière IP détectée
let activeContainers = []; // Stocker les conteneurs actifs
let serverStatus = null; // Stocker le statut du serveur

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  // Personnaliser le User Agent pour la fenêtre principale
  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('UA final (fenêtre principale) =', mainWindow.webContents.getUserAgent());
  });

  // Intercepter tous les window.open() du renderer
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('[setWindowOpenHandler] Intercepted URL:', url);

    // Créer manuellement la nouvelle fenêtre
    const childWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      }
    });

    // Appliquer le même user agent
    childWindow.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    childWindow.webContents.on('did-finish-load', () => {
      console.log('UA final (fenêtre enfant) =', childWindow.webContents.getUserAgent());
    });

    // Charger l’URL interceptée
    childWindow.loadURL(url);

    // On empêche Electron de créer la fenêtre par défaut
    return { action: 'deny' };
  });

  // Ouvrir DevTools si besoin
  mainWindow.webContents.openDevTools();

  // Charger votre app React
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile('dist/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startUdpBackend() {
  const udpServerPath = path.join(__dirname, 'udpServer.js');
  udpProcess = fork(udpServerPath);

  // Écouter les messages du processus WebSocket
  udpProcess.on('message', (msg) => {
    console.log('Message reçu de udpServer :', msg);

    if (msg.type === 'ryvie-ip') {
      console.log(`IP détectée dans main.js : ${msg.ip}`);
      lastKnownServerIP = msg.ip;

      if (mainWindow) {
        mainWindow.webContents.send('ryvie-ip', {
          ip: msg.ip,
          message: msg.message,
        });
      }
    } else if (msg.type === 'containers') {
      console.log('Conteneurs mis à jour :', msg.containers);
      activeContainers = msg.containers;

      if (mainWindow) {
        mainWindow.webContents.send('containers-updated', activeContainers);
      }
    } else if (msg.type === 'status') {
      console.log('Statut du serveur mis à jour :', msg.status);
      serverStatus = msg.status;

      if (mainWindow) {
        mainWindow.webContents.send('server-status', serverStatus);
      }
    }
  });

  udpProcess.on('exit', (code) => {
    console.log(`UDP/WebSocket process exited with code ${code}`);
  });
}

// Répondre aux requêtes pour l'état initial du serveur
ipcMain.handle('request-initial-server-ip', () => lastKnownServerIP);
ipcMain.handle('request-active-containers', () => activeContainers);
ipcMain.handle('request-server-status', () => serverStatus);

app.whenReady().then(() => {
  createWindow();
  startUdpBackend();
});

app.on('window-all-closed', () => {
  if (udpProcess) {
    udpProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
