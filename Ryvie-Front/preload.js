const { contextBridge, ipcRenderer } = require('electron');

console.log('preload.js chargé');

contextBridge.exposeInMainWorld('electronAPI', {
  onRyvieIP: (callback) => {
    ipcRenderer.on('ryvie-ip', (event, ip) => {
      console.log(`IP reçue dans preload.js : ${ip}`);
      callback(ip);
    });
  },
});

// Ce script sera chargé avant que la page soit rendue
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
      const element = document.getElementById(selector);
      if (element) element.innerText = text;
    }
  
    // Remplacer les versions dans la page par les versions des dépendances
    for (const type of ['chrome', 'node', 'electron']) {
      replaceText(`${type}-version`, process.versions[type]);
    }
  });
  