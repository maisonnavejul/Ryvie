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
  // Obtenir la date du jour formatée
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Définir le chemin sans créer le dossier immédiatement
  downloadPath = path.join(app.getPath('downloads'), `Ryvie-rDrop-${dateStr}`);
  app.setPath('downloads', downloadPath);
  
  // ⚠️ Configuration globale pour tous les téléchargements
  app.commandLine.appendSwitch('disable-features', 'DownloadBubble,DownloadBubbleV2');
  
  // Préférence de téléchargement pour toutes les sessions
  session.defaultSession.on('will-download', (event, item) => {
    console.log('Téléchargement détecté dans la session par défaut');
    
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
      console.log(`Dossier de téléchargement créé: ${downloadPath}`);
    }
    
    const filePath = path.join(downloadPath, item.getFilename());
    item.setSavePath(filePath);
  });
  
  // Assurer que le dossier de téléchargement existe au démarrage
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log(`Dossier de téléchargement créé: ${downloadPath}`);
  }
});

// Gestionnaire pour changer le dossier de téléchargement
ipcMain.handle('change-download-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    // Obtenir la date du jour formatée
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    downloadPath = path.join(result.filePaths[0], `Ryvie-rDrop-${dateStr}`);
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
  console.log("=== INFORMATIONS UTILISATEUR CONNECTÉ ===");
  console.log("Utilisateur connecté:", userId);
  console.log("Rôle de l'utilisateur:", userRole);
  console.log("Mode d'accès:", accessMode);
  console.log("========================================");

  const userSession = session.fromPartition(`persist:${userId}-${accessMode}-${userRole}`);
  console.log(`Création de la fenêtre pour l'utilisateur: ${userId} avec le mode ${accessMode} et le rôle ${userRole}`);
  
  // Configurer les préférences de téléchargement de manière globale
  userSession.setDownloadPath(downloadPath);
  
  // Définir explicitement saveAs: false pour toutes les demandes de téléchargement
  const originalDownloadURL = userSession.downloadURL;
  userSession.downloadURL = (url, options = {}) => {
    console.log("Téléchargement URL intercepté:", url);
    return originalDownloadURL.call(userSession, url, {
      ...options,
      saveAs: false
    });
  };
  
  // Désactiver complètement le dialogue de téléchargement
  userSession.on('will-download', (event, item, webContents) => {
    // Assurer que le répertoire existe
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
      console.log(`Dossier de téléchargement créé: ${downloadPath}`);
    }
    
    // Récupérer les informations sur le fichier
    const fileName = item.getFilename();
    const filePath = path.join(downloadPath, fileName);
    console.log(`⬇️ Téléchargement en cours: ${fileName} -> ${filePath}`);
    
    // Définir le chemin et d'autres options
    item.setSaveDialogOptions({ defaultPath: filePath });
    item.setSavePath(filePath);
    
    // Suivre l'élément de téléchargement
    pendingDownloads.add(item);
    
    // Surveiller la progression
    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        if (item.isPaused()) {
          console.log(`Téléchargement en pause: ${fileName}`);
        } else {
          const progress = Math.round((item.getReceivedBytes() / item.getTotalBytes()) * 100);
          console.log(`Progression ${fileName}: ${progress}%`);
        }
      } else if (state === 'interrupted') {
        console.log(`Téléchargement interrompu: ${fileName}`);
      }
    });
    
    // Gérer la fin du téléchargement
    item.on('done', (event, state) => {
      pendingDownloads.delete(item);
      
      if (state === 'completed') {
        console.log(`✅ Téléchargement terminé: ${fileName}`);
        
        // Informer la fenêtre rDrop si tous les téléchargements sont terminés
        if (pendingDownloads.size === 0 && webContents.getURL().includes('rdrop')) {
          console.log('📦 Tous les téléchargements terminés!');
          webContents.send('download-complete', {
            fileName,
            path: filePath
          });
        }
      } else {
        console.error(`❌ Erreur lors du téléchargement de ${fileName}: ${state}`);
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

  // Ajouter un événement pour transmettre les informations d'authentification
  window.webContents.on('did-finish-load', () => {
    const token = global.authToken;
    const currentUser = global.currentUser;
    const currentUserRole = global.currentUserRole;
    
    // Transmettre l'authentification si les informations sont disponibles
    if (token && currentUser && userId === currentUser) {
      window.webContents.send('set-auth-token', {
        token,
        userId: currentUser,
        userRole: currentUserRole
      });
      
      // Effacer les variables globales après transmission
      global.authToken = null;
      global.currentUser = null;
      global.currentUserRole = null;
    }
    
    // Transmettre l'utilisateur actuel
    window.webContents.send('set-current-user', userId);
    window.webContents.send('set-user-role', userRole);
    
    // Stocker les informations dans localStorage via le processus de rendu
    window.webContents.executeJavaScript(`
      localStorage.setItem('currentUser', '${userId}');
      localStorage.setItem('currentUserRole', '${userRole}');
      console.log('Informations utilisateur stockées dans localStorage:', '${userId}', '${userRole}');
    `);
  });
  
  window.loadURL(process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'dist/index.html')}`);

  userWindows.set(`${userId}-${accessMode}-${userRole}`, window);
  return window;
}

// Add a new IPC handler to create windows with specific access mode
ipcMain.handle('create-user-window-with-mode', async (event, userId, accessMode, userRole, token) => {
  // Vérification rigoureuse des paramètres
  if (!userId || !accessMode || !userRole || !token) {
    console.error("❌ Paramètres manquants ou invalides:", { userId, accessMode, userRole, tokenPresent: !!token });
    return false; // Ne pas fermer la fenêtre en cas de paramètres manquants
  }

  if (userWindows.has(`${userId}-${accessMode}-${userRole}`)) {
    const existingWindow = userWindows.get(`${userId}-${accessMode}-${userRole}`);
    if (!existingWindow.isDestroyed()) {
      existingWindow.focus();
      return true;
    }
    userWindows.delete(`${userId}-${accessMode}-${userRole}`);
  }

  try {
    // Store access mode globally
    global.accessMode = accessMode;
    console.log(`Mode d'accès défini : ${accessMode}`);

    // Create a new window for the user
    const window = createWindowForUser(userId, accessMode, userRole);
    
    // Store the token for transfer to the new window
    global.authToken = token;
    global.currentUser = userId;
    global.currentUserRole = userRole;
    
    // Add the window to the map
    userWindows.set(`${userId}-${accessMode}-${userRole}`, window);
    
    // Wait for window to be ready before closing login window
    return new Promise((resolve) => {
      window.webContents.once('did-finish-load', () => {
        console.log("✅ Nouvelle fenêtre utilisateur chargée avec succès");
        // Close the login window after creating the new window successfully
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (senderWindow && !senderWindow.isDestroyed()) {
          // Petit délai pour s'assurer que la nouvelle fenêtre est bien chargée
          setTimeout(() => {
            senderWindow.close();
          }, 1000);
        }
        resolve(true);
      });
      
      // Si le chargement échoue, ne pas fermer la fenêtre de login
      window.webContents.once('did-fail-load', (e, errorCode, errorDescription) => {
        console.error("❌ Échec du chargement de la nouvelle fenêtre:", errorDescription);
        resolve(false);
      });
    });
  } catch (error) {
    console.error("❌ Erreur lors de la création de la fenêtre:", error);
    return false; // Ne pas fermer la fenêtre en cas d'erreur
  }
});

// Ajouter un gestionnaire IPC pour fermer la fenêtre actuelle
ipcMain.handle('close-current-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window && !window.isDestroyed()) {
    window.close();
    return true;
  }
  return false;
});

// Gestionnaire pour les notifications de fichiers reçus via rDrop
ipcMain.handle('notify-file-received', (event, fileName) => {
  console.log(`Notification de réception de fichier: ${fileName}`);
  
  // Vérifier si le dossier de téléchargement existe, sinon le créer
  if (!fs.existsSync(downloadPath)) {
    try {
      fs.mkdirSync(downloadPath, { recursive: true });
      console.log(`Dossier de téléchargement créé: ${downloadPath}`);
    } catch (error) {
      console.error(`Erreur lors de la création du dossier: ${error}`);
    }
  }
  
  // Récupérer les informations de la fenêtre pour l'envoi de notifications
  const webContents = event.sender;
  if (webContents && webContents.getURL().includes('rdrop')) {
    // Si nous sommes dans rDrop, envoyer une notification de confirmation
    webContents.send('download-ready', {
      fileName,
      downloadPath
    });
  }
  
  return {
    success: true,
    fileName,
    downloadPath
  };
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
  //const accessMode = global.accessMode || 'private';
  const accessMode = 'private';
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

// Gestion de l'ouverture de fenêtres externes sans barre de menu
ipcMain.handle('open-external-window', async (event, url) => {
  try {
    // Récupérer l'utilisateur actuel et son mode d'accès depuis la fenêtre qui a fait l'appel
    const sender = event.sender;
    const webContents = sender.webContents || sender;
    const session = webContents.session;
    
    // Créer une nouvelle fenêtre
    const childWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: session, // Réutiliser la même session pour conserver les cookies/authentification
        sandbox: false,
        webSecurity: false,
      },
      autoHideMenuBar: true,   // Cache automatiquement la barre de menu
      frame: true,            // Garde le cadre de la fenêtre pour pouvoir la déplacer
    });
    
    // Supprimer complètement le menu
    childWindow.setMenu(null);
    
    // Copier l'User-Agent de la fenêtre parente
    childWindow.webContents.setUserAgent(webContents.getUserAgent());
    
    // Charger l'URL
    childWindow.loadURL(url);
    
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'ouverture de la fenêtre externe:', error);
    return false;
  }
});

function createLoginWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: true,
      webSecurity: false
    },
    autoHideMenuBar: true, // Cache automatiquement la barre de menu ( enlever si besoin)
    frame: true,
  });

  // Load the login page
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000/#/login';
  mainWindow.loadURL(startUrl);
  
  // Open the DevTools in development mode
  //if (process.env.NODE_ENV === 'development') {
   // mainWindow.webContents.openDevTools();
  //}
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  console.log('Fenêtre de login créée avec succès');
}

app.whenReady().then(() => {
  // Nous n'initialisons plus automatiquement un utilisateur par défaut
  // car nous utilisons maintenant la page de connexion
  // initializeDefaultUser();
  
  // Créer une fenêtre de connexion au démarrage
  createLoginWindow();
  
  // Démarrer uniquement le backend UDP
  startUdpBackend();
});

app.on('window-all-closed', () => {
  if (udpProcess) udpProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // Initialize the default user
    //initializeDefaultUser();
  }
});

// Assurer que le dossier de téléchargement existe avant un téléchargement
app.on('session-created', (session) => {
  session.on('will-download', (event, item) => {
    // Créer le dossier de téléchargement uniquement quand un téléchargement démarre
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
  });
});
