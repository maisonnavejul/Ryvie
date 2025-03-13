const io = require('socket.io-client');
const { getServerUrl } = require('./src/config/urls');

// Récupérer le mode d'accès depuis les arguments de ligne de commande
const args = process.argv.slice(2);
const accessMode = args[0] || 'private';

// Déterminer l'URL du serveur en fonction du mode d'accès
const serverUrl = getServerUrl(accessMode);
console.log(`Mode d'accès: ${accessMode}, Connexion au serveur: ${serverUrl}`);

// Connexion au serveur WebSocket
const socket = io(serverUrl);

// Envoyer un message de découverte
socket.emit('discover');
console.log('Message de découverte envoyé');

// Écouter les réponses pour détecter un serveur
socket.on('server-detected', (data) => {
  console.log('Serveur détecté :', data.message, 'IP :', data.ip);

  // Envoyer les informations au processus parent
  if (process.send) {
    process.send({
      type: 'ryvie-ip',
      ip: data.ip,
      message: data.message,
    });
  }
});

// Écouter la liste des conteneurs actifs
socket.on('containers', (data) => {
  console.log('Conteneurs actifs :', data.activeContainers);

  // Envoyer les informations au processus parent
  if (process.send) {
    process.send({
      type: 'containers',
      containers: data.activeContainers,
    });
  }
});

// Écouter le statut du serveur
socket.on('status', (data) => {
  console.log('Statut du serveur :', data);

  // Envoyer les informations au processus parent
  if (process.send) {
    process.send({
      type: 'status',
      status: data,
    });
  }
});
