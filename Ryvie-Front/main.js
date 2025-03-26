const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const { getServerUrl } = require('./src/config/urls');

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('ignore-certificate-errors');

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

function createWindowForUser(userId, accessMode, userRole) {
  const userSession = session.fromPartition(`persist:${userId}-${accessMode}-${userRole}`);
  console.log(`Création de la fenêtre pour l'utilisateur: ${userId} avec le mode ${accessMode} et le rôle ${userRole}`);

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
      partition: `persist:${userId}-${accessMode}-${userRole}`
    },
    autoHideMenuBar: true, // Cache automatiquement la barre de menu ( enlever si besoin)
    frame: true, // Garde le cadre de la fenêtre pour pouvoir la déplacer ( enlever si besoin)
  });

  window.setMenu(null); // Supprimer complètement le menu ( enlever si besoin)

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
        partition: `persist:${userId}-${accessMode}-${userRole}`
      },
      autoHideMenuBar: true, // Cache automatiquement la barre de menu ( enlever si besoin)
      frame: true, // Garde le cadre de la fenêtre pour pouvoir la déplacer ( enlever si besoin)
    });

    childWindow.setMenu(null); // Supprimer complètement le menu de la fenêtre enfant ( enlever si besoin)

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

  userWindows.set(`${userId}-${accessMode}-${userRole}`, window);
  return window;
}

// Add a new IPC handler to create windows with specific access mode
ipcMain.handle('create-user-window-with-mode', async (event, userId, accessMode, userRole) => {
  if (userWindows.has(`${userId}-${accessMode}-${userRole}`)) {
    const existingWindow = userWindows.get(`${userId}-${accessMode}-${userRole}`);
    if (!existingWindow.isDestroyed()) {
      existingWindow.focus();
      return;
    }
  }
  createWindowForUser(userId, accessMode, userRole);
  return true;
});

// Modify the existing create-user-window handler to use the default mode
ipcMain.handle('create-user-window', async (event, userId, userRole) => {
  // Default to 'private' mode for backward compatibility
  return ipcMain.handle('create-user-window-with-mode', event, userId, 'private', userRole);
});

// Function to fetch users from the API
async function fetchUsers(accessMode) {
  try {
    const serverUrl = getServerUrl(accessMode);
    const response = await axios.get(`${serverUrl}/api/users`);
    const users = response.data.map(user => ({
      name: user.name || user.uid,
      id: user.uid,
      email: user.email || 'Non défini',
      role: user.role || 'User'
    }));
    console.log('Users fetched successfully:', users.length);
    return users;
  } catch (err) {
    console.error('Error fetching users:', err.message);
    return [];
  }
}

// Add a new IPC handler to update the session partition without creating a new window
ipcMain.handle('update-session-partition', async (event, userId, accessMode, userRole) => {
  console.log(`Mise à jour de la partition de session pour l'utilisateur: ${userId} avec le mode ${accessMode}`);
  
  // Si userRole n'est pas fourni, essayer de le récupérer depuis l'API
  if (!userRole) {
    try {
      const users = await fetchUsers(accessMode);
      const userObj = users.find(user => user.id === userId || user.name === userId);
      if (userObj) {
        userRole = userObj.role || 'User';
      } else {
        userRole = 'User';
      }
    } catch (err) {
      console.error('Error getting user role:', err.message);
      userRole = 'User';
    }
  }
  
  console.log(`Partition de session mise à jour pour ${userId} en mode ${accessMode} avec le rôle ${userRole}`);
  
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
  userWindows.set(`${userId}-${accessMode}-${userRole}`, senderWindow);
  
  // Store the current user and access mode in the window object for future reference
  senderWindow.userId = userId;
  senderWindow.accessMode = accessMode;
  senderWindow.userRole = userRole;
  
  console.log(`Partition de session mise à jour pour ${userId} en mode ${accessMode} avec le rôle ${userRole}`);
  return true;
});

ipcMain.handle('clear-user-session', async (event, userId, accessMode = 'private', userRole) => {
  const userSession = session.fromPartition(`persist:${userId}-${accessMode}-${userRole}`);
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
  
  // Récupérer le mode d'accès depuis le localStorage
  const accessMode = global.accessMode || 'private';
  console.log(`Démarrage du processus UDP avec le mode d'accès: ${accessMode}`);
  
  // Passer le mode d'accès comme argument au processus
  udpProcess = fork(udpServerPath, [accessMode]);

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

// Gestionnaire pour mettre à jour le mode d'accès global
ipcMain.on('update-access-mode', (event, mode) => {
  console.log(`Mode d'accès mis à jour: ${mode}`);
  global.accessMode = mode;
  
  // Redémarrer le processus UDP avec le nouveau mode d'accès
  if (udpProcess) {
    console.log('Redémarrage du processus UDP avec le nouveau mode d\'accès');
    udpProcess.kill();
    startUdpBackend();
  }
});

// Initialize the default user with role from LDAP
async function initializeDefaultUser() {
  try {
    // Default user ID
    const defaultUserId = 'jules';
    
    // Try to fetch users to get the role for the default user
    try {
      const users = await fetchUsers('private');
      console.log('Fetched users for initialization:', users.length);
      
      // Look for jules in the users
      const defaultUser = users.find(user => 
        user.id === defaultUserId || 
        user.name === defaultUserId || 
        user.id.toLowerCase() === defaultUserId || 
        user.name.toLowerCase() === defaultUserId
      );
      
      if (defaultUser) {
        console.log(`Default user found: ${defaultUser.name} with role ${defaultUser.role}`);
        // Create window for the default user with their role
        createWindowForUser(defaultUser.id, 'private', defaultUser.role);
      } else {
        console.log(`Default user "${defaultUserId}" not found in LDAP, using as is`);
        //createWindowForUser(defaultUserId);
      }
    } catch (error) {
      console.error('Error fetching users for initialization:', error);
      //createWindowForUser(defaultUserId);
    }
    
    // Start the UDP backend
    startUdpBackend();
  } catch (error) {
    console.error('Error initializing default user:', error);
    // Fallback to just using 'jules' without role information
    //createWindowForUser('jules');
    startUdpBackend();
  }
}

app.whenReady().then(() => {
  // Initialize the default user
  initializeDefaultUser();
});

app.on('window-all-closed', () => {
  if (udpProcess) udpProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Initialize the default user
    initializeDefaultUser();
  }
});
