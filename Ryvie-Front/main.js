const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process'); // Importer fork pour les processus enfants



app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-software-rasterizer');

process.env.NODE_ENV = 'development';

let mainWindow;
let udpProcess; // Variable pour stocker le processus enfant

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
//devtools
mainWindow.webContents.openDevTools();
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

  udpProcess.on('message', (msg) => {
    if (msg.type === 'ryvie-ip') {
      console.log(`IP détectée dans main.js : ${msg.ip}`);
      mainWindow.webContents.send('ryvie-ip', msg.ip);
      if (mainWindow) {
        mainWindow.webContents.send('ryvie-ip', msg.ip);
        console.log(`IP envoyée au frontend : ${msg.ip}`);
      }
    }
  });
  

  udpProcess.on('exit', (code) => {
    console.log(`UDP process exited with code ${code}`);
  });
}

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