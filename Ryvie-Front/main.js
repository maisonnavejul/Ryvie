const { app, BrowserWindow } = require('electron');
const path = require('path');

// Activer le rechargement automatique du processus principal
require('electron-reload')(__dirname, {
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
});

app.disableHardwareAcceleration();
process.env.NODE_ENV = 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    },
  });

  // Gestion des erreurs de certificat SSL
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // Ignore les erreurs de certificat
    event.preventDefault();
    callback(true); // Accepte le certificat non valide
  });

  // Si on est en mode développement, charger l'URL du serveur Webpack
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // En mode production, charger le fichier HTML compilé
    mainWindow.loadFile('dist/index.html');
  }

  mainWindow.webContents.openDevTools(); // Ouvre les DevTools pour le debug

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
