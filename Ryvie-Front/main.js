const { app, BrowserWindow, ipcMain, session } = require('electron');
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

// Stocker les sessions et fenêtres par utilisateur
const userWindows = new Map();
const userSessions = new Map();

function createWindowForUser(userId) {
  // Créer une session persistante pour l'utilisateur
  const userSession = session.fromPartition(`persist:${userId}`);
  userSessions.set(userId, userSession);

  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      partition: `persist:${userId}` // Utiliser la partition ici au lieu de l'objet session
    },
  });

  // Personnaliser le User Agent
  window.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  window.loadURL(process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'dist/index.html')}`
  );

  userWindows.set(userId, window);
  return window;
}

// Gérer la création de fenêtre pour un utilisateur spécifique
ipcMain.handle('create-user-window', async (event, userId) => {
  if (userWindows.has(userId)) {
    const existingWindow = userWindows.get(userId);
    if (!existingWindow.isDestroyed()) {
      existingWindow.focus();
      return;
    }
  }
  
  const window = createWindowForUser(userId);
  return true;
});

// Nettoyer la session d'un utilisateur
ipcMain.handle('clear-user-session', async (event, userId) => {
  if (userSessions.has(userId)) {
    const session = userSessions.get(userId);
    await session.clearStorageData();
    userSessions.delete(userId);
  }
  
  if (userWindows.has(userId)) {
    const window = userWindows.get(userId);
    if (!window.isDestroyed()) {
      window.close();
    }
    userWindows.delete(userId);
  }
});

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
  // Créer la fenêtre principale avec la session de Jules par défaut
  mainWindow = createWindowForUser('jules');
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
    mainWindow = createWindowForUser('jules');
  }
});
