const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-software-rasterizer');

process.env.NODE_ENV = 'development';

let mainWindow;
let udpProcess;
let lastKnownServerIP = null;
let activeContainers = [];
let serverStatus = null;
let downloadPath = '';
let pendingDownloads = new Set();
let pendingUploads = new Set();

// Stocker les sessions et fenêtres par utilisateur
const userWindows = new Map();
const userSessions = new Map();

// Configuration du dossier de téléchargement par défaut
app.on('ready', () => {
  downloadPath = path.join(app.getPath('downloads'), 'Ryvie-rDrop');
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  app.setPath('downloads', downloadPath);
});

// Gestionnaire pour changer le dossier de téléchargement
ipcMain.handle('change-download-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    downloadPath = path.join(result.filePaths[0], 'Ryvie-rDrop');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    app.setPath('downloads', downloadPath);
    return downloadPath;
  }
  return null;
});

// Gestionnaire pour obtenir le dossier de téléchargement actuel
ipcMain.handle('get-download-folder', () => {
  return downloadPath;
});

// Gestionnaire pour la réception de fichiers
ipcMain.on('file-received', (event) => {
  const webContents = event.sender;
  if (webContents.getURL().includes('rdrop')) {
    // showNotification(webContents, 'Fichiers reçus avec succès');
  }
});

function createWindowForUser(userId, accessMode = 'private') {
  const userSession = session.fromPartition(`persist:${userId}-${accessMode}`);
  console.log(`Création de la fenêtre pour l'utilisateur: ${userId} avec le mode ${accessMode}`);

  userSession.on('will-download', (event, item, webContents) => {
    const filePath = path.join(downloadPath, item.getFilename());
    item.setSavePath(filePath);

    pendingDownloads.add(item);

    item.on('done', (event, state) => {
      pendingDownloads.delete(item);

      if (state === 'completed') {
        if (pendingDownloads.size === 0 && webContents.getURL().includes('rdrop')) {
          // showNotification(webContents, 'Vos fichiers ont été envoyés avec succès');
        }
      } else {
        console.error('Erreur lors du téléchargement:', state);
      }
    });
  });

  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: `persist:${userId}-${accessMode}`
    },
  });

  window.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );

  window.webContents.setWindowOpenHandler(({ url }) => {
    const childWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        partition: `persist:${userId}-${accessMode}`
      }
    });

    childWindow.webContents.setUserAgent(window.webContents.getUserAgent());
    childWindow.loadURL(url);

    return { action: 'deny' };
  });

  window.loadURL(process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'dist/index.html')}`);

  // Pass the user ID to the renderer process once the window is loaded
  window.webContents.on('did-finish-load', () => {
    window.webContents.send('set-current-user', userId);
  });

  userWindows.set(`${userId}-${accessMode}`, window);
  return window;
}

// Add a new IPC handler to create windows with specific access mode
ipcMain.handle('create-user-window-with-mode', async (event, userId, accessMode) => {
  if (userWindows.has(`${userId}-${accessMode}`)) {
    const existingWindow = userWindows.get(`${userId}-${accessMode}`);
    if (!existingWindow.isDestroyed()) {
      existingWindow.focus();
      return;
    }
  }
  createWindowForUser(userId, accessMode);
  return true;
});

// Modify the existing create-user-window handler to use the default mode
ipcMain.handle('create-user-window', async (event, userId) => {
  // Default to 'private' mode for backward compatibility
  return ipcMain.handle('create-user-window-with-mode', event, userId, 'private');
});

// Add a new IPC handler to update the session partition without creating a new window
ipcMain.handle('update-session-partition', async (event, userId, accessMode) => {
  console.log(`Mise à jour de la partition de session pour l'utilisateur: ${userId} avec le mode ${accessMode}`);
  
  // Get the sender window
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow) {
    console.error('Fenêtre expéditrice non trouvée');
    return false;
  }
  
  // Update the session partition for the current window
  // Note: We can't actually change the partition of an existing window,
  // but we can update our internal mapping to ensure future operations use the correct partition
  
  // Remove the old mapping (if any)
  for (const [key, window] of userWindows.entries()) {
    if (window === senderWindow) {
      userWindows.delete(key);
      break;
    }
  }
  
  // Add the new mapping
  userWindows.set(`${userId}-${accessMode}`, senderWindow);
  
  // Store the current user and access mode in the window object for future reference
  senderWindow.userId = userId;
  senderWindow.accessMode = accessMode;
  
  console.log(`Partition de session mise à jour pour ${userId} en mode ${accessMode}`);
  return true;
});

ipcMain.handle('clear-user-session', async (event, userId, accessMode = 'private') => {
  const userSession = session.fromPartition(`persist:${userId}-${accessMode}`);
  await userSession.clearStorageData();

  if (userWindows.has(`${userId}-${accessMode}`)) {
    const window = userWindows.get(`${userId}-${accessMode}`);
    if (!window.isDestroyed()) {
      window.close();
    }
    userWindows.delete(`${userId}-${accessMode}`);
  }
});

function startUdpBackend() {
  const udpServerPath = path.join(__dirname, 'udpServer.js');
  udpProcess = fork(udpServerPath);

  // Écouter les messages du processus WebSocket
  udpProcess.on('message', (msg) => {
    console.log('Message reçu de udpServer :', msg);

    if (msg.type === 'ryvie-ip') {
      console.log(`IP détectée dans main.js : ${msg.ip}`);
      lastKnownServerIP = msg.ip;

      for (const [userId, window] of userWindows.entries()) {
        if (!window.isDestroyed()) {
          window.webContents.send('ryvie-ip', {
            ip: msg.ip,
            message: msg.message,
          });
        }
      }
    } else if (msg.type === 'containers') {
      console.log('Conteneurs mis à jour :', msg.containers);
      activeContainers = msg.containers;

      // Send to all open windows
      for (const [userId, window] of userWindows.entries()) {
        if (!window.isDestroyed()) {
          window.webContents.send('containers-updated', activeContainers);
        }
      }
    } else if (msg.type === 'status') {
      console.log('Statut du serveur mis à jour :', msg.status);
      serverStatus = msg.status;

      // Send to all open windows
      for (const [userId, window] of userWindows.entries()) {
        if (!window.isDestroyed()) {
          window.webContents.send('server-status', serverStatus);
        }
      }
    }
  });

  udpProcess.on('exit', (code) => {
    console.log(`UDP/WebSocket process exited with code ${code}`);
  });
}

ipcMain.handle('request-initial-server-ip', () => lastKnownServerIP);
ipcMain.handle('request-active-containers', () => activeContainers);
ipcMain.handle('request-server-status', () => serverStatus);

app.whenReady().then(() => {
  // Set Jules as the default user
  createWindowForUser('jules');
  startUdpBackend();
});

app.on('window-all-closed', () => {
  if (udpProcess) udpProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Set Jules as the default user
    createWindowForUser('jules');
  }
});
