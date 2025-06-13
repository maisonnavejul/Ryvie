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
  // Recevoir l'ID utilisateur actuel
  onSetCurrentUser: (callback) => ipcRenderer.on('set-current-user', callback),
  // Recevoir le token d'authentification
  onSetAuthToken: (callback) => ipcRenderer.on('set-auth-token', callback),

  // Fonctions de gestion du dossier de téléchargement
  changeDownloadFolder: () => ipcRenderer.invoke('change-download-folder'),
  getDownloadFolder: () => ipcRenderer.invoke('get-download-folder'),

  // Mettre à jour le mode d'accès global
  updateAccessMode: (mode) => ipcRenderer.send('update-access-mode', mode),

  // Ouvrir une fenêtre externe sans barre de menu
  openExternalWindow: (url) => ipcRenderer.invoke('open-external-window', url),

  // Nouvelles fonctions pour la gestion des sessions utilisateur
  invoke: (channel, ...args) => {
    const validChannels = ['create-user-window', 'clear-user-session', 'create-user-window-with-mode', 'update-session-partition', 'close-current-window'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Channel "${channel}" is not allowed`);
  },
  
  // Fermer la fenêtre actuelle
  closeCurrentWindow: () => ipcRenderer.invoke('close-current-window'),
  notifyFileReceived: (fileName) => ipcRenderer.invoke('notify-file-received', fileName)
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

// Injection d'un script pour intercepter les téléchargements de rDrop
if (window.location.href.toLowerCase().includes('rdrop')) {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('Injection du script pour rDrop');
    
    // Délai pour laisser le temps à rDrop de se charger complètement
    setTimeout(() => {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          console.log('Script rDrop - Intercepteur de téléchargements activé');
          
          // Fonction pour créer un bouton d'info pour voir si notre script est chargé
          function addInfoButton() {
            if (document.querySelector('#rdrop-electron-status')) return;
            const infoDiv = document.createElement('div');
            infoDiv.id = 'rdrop-electron-status';
            infoDiv.style.position = 'fixed';
            infoDiv.style.bottom = '10px';
            infoDiv.style.right = '10px';
            infoDiv.style.backgroundColor = 'rgba(0,255,0,0.7)';
            infoDiv.style.padding = '5px';
            infoDiv.style.borderRadius = '5px';
            infoDiv.style.zIndex = '9999';
            infoDiv.innerHTML = 'Electron Download Handler Active';
            document.body.appendChild(infoDiv);
          }
          addInfoButton();
          
          // ----- INTERCEPTION DES MÉTHODES DE TÉLÉCHARGEMENT -----
          
          // 1. Intercepter les liens avec l'attribut "download"
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a[download], button[download]');
            if (link) {
              console.log('Clic sur lien de téléchargement intercepté:', link);
              // Le téléchargement sera géré par Electron
            }
          }, true);
          
          // 2. Surveiller la création d'éléments <a> avec attribut download
          const originalCreateElement = document.createElement;
          document.createElement = function(tagName) {
            const element = originalCreateElement.call(document, tagName);
            
            if (tagName.toLowerCase() === 'a') {
              const originalSetAttribute = element.setAttribute;
              element.setAttribute = function(name, value) {
                if (name === 'download') {
                  console.log('Élément de téléchargement créé:', value);
                }
                return originalSetAttribute.call(this, name, value);
              };
            }
            return element;
          };
          
          // 3. Intercepter URL.createObjectURL pour les blobs
          const originalCreateObjectURL = window.URL.createObjectURL;
          window.URL.createObjectURL = function(object) {
            const url = originalCreateObjectURL.call(this, object);
            console.log('Blob URL créée:', url, object);
            return url;
          };
          
          // 4. Intercepter les événements spécifiques de rDrop
          if (window.Events && window.Events.on) {
            console.log('Hooks de rDrop détectés, injection des écouteurs');
            
            // Fichier reçu
            window.Events.on('fileReceived', (data) => {
              if (window.electronAPI) {
                console.log('rDrop: Fichier reçu:', data);
                window.electronAPI.notifyFileReceived(data.name || 'fichier');
              }
            });
            
            // Fichier téléchargé
            window.Events.on('fileDownloaded', (data) => {
              console.log('rDrop: Fichier téléchargé:', data);
            });
            
            // Transfert terminé
            window.Events.on('transferComplete', (data) => {
              console.log('rDrop: Transfert terminé:', data);
            });
            
            // Tout événement contenant "file" ou "download"
            Object.keys(window.Events._events || {}).forEach(eventName => {
              if (eventName.toLowerCase().includes('file') || 
                  eventName.toLowerCase().includes('download')) {
                console.log('rDrop: Événement détecté:', eventName);
                window.Events.on(eventName, (data) => {
                  console.log(\`rDrop: \${eventName} déclenché:\`, data);
                });
              }
            });
          } else {
            console.log('API Events de rDrop non détectée');
            
            // Ajouter un observateur pour la détecter plus tard
            let checkInterval = setInterval(() => {
              if (window.Events && window.Events.on) {
                console.log('API Events de rDrop détectée après délai');
                clearInterval(checkInterval);
                // Recommencer l'injection
                setTimeout(() => {
                  const event = new Event('rdrop-events-ready');
                  document.dispatchEvent(event);
                }, 500);
              }
            }, 1000);
          }
          
          // Observer pour le bouton de téléchargement spécifique à rDrop
          const observer = new MutationObserver((mutations) => {
            const downloadButtons = document.querySelectorAll('.download-btn, [download], .btn-download');
            if (downloadButtons.length > 0) {
              downloadButtons.forEach(btn => {
                // Vérifier si on a déjà traité ce bouton
                if (!btn.dataset.electronHandled) {
                  btn.dataset.electronHandled = 'true';
                  console.log('Bouton de téléchargement détecté et intercepté:', btn);
                }
              });
            }
          });
          
          observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'download']
          });
          
          console.log('Interception des téléchargements activée');
        })();
      `;
      document.head.appendChild(script);
    }, 1000); // Donner du temps pour que la page se charge
  });
}