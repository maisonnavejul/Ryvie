const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Écouter les messages d'IP
  onRyvieIP: (callback) => {
    const listener = (_, ip) => callback(ip);
    ipcRenderer.on('ryvie-ip', listener);
    return () => ipcRenderer.removeListener('ryvie-ip', listener); // Retourne une fonction de nettoyage
  },
  // Demander l'état initial du serveur
  requestInitialServerIP: async () => {
    const ip = await ipcRenderer.invoke('request-initial-server-ip');
    console.log(`IP initiale reçue dans preload.js : ${ip}`);
    return ip;
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
  