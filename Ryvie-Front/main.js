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
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    },
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
