const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Récupérer la dernière IP connue
  requestInitialServerIP: () => ipcRenderer.invoke('request-initial-server-ip'),
  // Récupérer les conteneurs actifs
  requestActiveContainers: () => ipcRenderer.invoke('request-active-containers'),
  // Récupérer le statut du serveur
  requestServerStatus: () => ipcRenderer.invoke('request-server-status'),
  // Écouter les événements en temps réel
  onRyvieIP: (callback) => ipcRenderer.on('ryvie-ip', callback),
  onContainersUpdated: (callback) => ipcRenderer.on('containers-updated', callback),
  onServerStatus: (callback) => ipcRenderer.on('server-status', callback),

  // Nouvelles fonctions pour la gestion des sessions utilisateur
  invoke: (channel, ...args) => {
    const validChannels = ['create-user-window', 'clear-user-session'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Channel "${channel}" is not allowed`);
  }
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