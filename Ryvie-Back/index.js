const dgram = require('dgram');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const Docker = require('dockerode');

const docker = new Docker(); // Interagir avec Docker
const udpServer = dgram.createSocket('udp4'); // Serveur UDP
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

// Correspondances des noms de conteneurs Docker avec des noms personnalisés
const containerMapping = {
  'nextcloud': 'Cloud',
  'portainer': 'Portainer',
  // Ajoutez d'autres correspondances ici si nécessaire
};

// Liste des conteneurs actifs maintenue en mémoire
let activeContainers = [];

// Fonction pour récupérer les conteneurs Docker actifs au démarrage
async function initializeActiveContainers() {
  return new Promise((resolve, reject) => {
    docker.listContainers({ all: false }, (err, containers) => {
      if (err) return reject(err);

      const containerNames = containers.map((container) => {
        const containerName = container.Names[0].replace('/', '');
        for (const key in containerMapping) {
          if (containerName.toLowerCase().includes(key)) {
            return containerMapping[key];
          }
        }
        return containerName;
      });

      resolve(containerNames);
    });
  });
}

// Serveur UDP - Diffusion et réponse
udpServer.on('listening', () => {
  const address = udpServer.address();
  console.log(`UDP Server listening on ${address.address}:${address.port}`);
});

udpServer.on('message', (message, remote) => {
  console.log(`Received UDP message: ${message} from ${remote.address}:${remote.port}`);

  // Réponse au message de découverte
  const response = JSON.stringify({
    message: 'Ryvie device here!',
    ip: getLocalIP(),
  });
  udpServer.send(response, 0, response.length, remote.port, remote.address, (err) => {
    if (err) console.error(err);
    else console.log(`Sent response to ${remote.address}:${remote.port}`);
  });
});

// Serveur HTTP et WebSocket
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

io.on('connection', async (socket) => {
  console.log('Un client est connecté');

  // Envoyer le statut du serveur
  socket.emit('status', { serverStatus: true });
  console.log('Statut envoyé au client.');

  // Envoyer la liste des conteneurs actifs
  socket.emit('containers', { activeContainers });
  console.log('Liste initiale des conteneurs actifs envoyée :', activeContainers);

  socket.on('disconnect', () => {
    console.log('Client déconnecté');
  });
});
// Écouter les événements Docker et mettre à jour la liste des conteneurs
docker.getEvents((err, stream) => {
  if (err) {
    console.error('Erreur lors de l\'écoute des événements Docker', err);
    return;
  }

  stream.on('data', (data) => {
    const event = JSON.parse(data.toString());

    if (event.Type === 'container' && (event.Action === 'start' || event.Action === 'stop')) {
      console.log(`Événement Docker capté : ${event.Action} pour ${event.Actor.Attributes.name}`);

      const containerName = event.Actor.Attributes.name;

      if (event.Action === 'start') {
        // Ajouter le conteneur à la liste s'il n'est pas déjà présent
        if (!activeContainers.includes(containerName)) {
          activeContainers.push(containerName);
          console.log(`Conteneur ajouté : ${containerName}`);
        }
      } else if (event.Action === 'stop') {
        // Retirer le conteneur de la liste
        activeContainers = activeContainers.filter((name) => name !== containerName);
        console.log(`Conteneur retiré : ${containerName}`);
      }

      // Envoyer la liste mise à jour aux clients connectés
      io.emit('containers', { activeContainers });
      console.log('Liste mise à jour envoyée :', activeContainers);
    }
  });
});

// Fonction pour récupérer l'adresse IP locale
function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    for (const addressInfo of addresses) {
      if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
        return addressInfo.address;
      }
    }
  }
  return 'IP not found';
}

// Initialisation et démarrage des serveurs
async function startServer() {
  try {
    // Initialiser la liste des conteneurs actifs
    activeContainers = await initializeActiveContainers();
    console.log('Liste initialisée des conteneurs actifs :', activeContainers);

    // Démarrer les serveurs
    httpServer.listen(3001, () => {
      const localIP = getLocalIP();
      console.log(`HTTP Server running on http://${localIP}:3001`);
    });

    udpServer.bind(41234, () => {
      udpServer.setBroadcast(true);
    });
  } catch (err) {
    console.error('Erreur lors de l\'initialisation du serveur :', err);
  }
}

startServer();
