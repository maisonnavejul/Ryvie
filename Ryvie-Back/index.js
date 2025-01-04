const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const Docker = require('dockerode');

const docker = new Docker(); // Interagir avec Docker
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
let isServerDetected = false;

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
        if (!activeContainers.includes(containerName)) {
          activeContainers.push(containerName);
          console.log(`Conteneur ajouté : ${containerName}`);
        }
      } else if (event.Action === 'stop') {
        activeContainers = activeContainers.filter((name) => name !== containerName);
        console.log(`Conteneur retiré : ${containerName}`);
      }

      io.emit('containers', { activeContainers });
      console.log('Liste mise à jour envoyée :', activeContainers);
    }
  });
});

// Serveur HTTP pour signaler la détection du serveur
app.get('/status', (req, res) => {
  res.status(200).json({
    message: 'Server is running',
    serverDetected: isServerDetected,
    ip: getLocalIP(),
  });
});

// WebSocket pour la détection en temps réel
io.on('connection', async (socket) => {
  console.log('Un client est connecté');

  socket.emit('status', { serverStatus: true });
  socket.emit('containers', { activeContainers });

  socket.on('discover', () => {
    console.log('Message de découverte reçu');
    isServerDetected = true;

    io.emit('server-detected', {
      message: 'Ryvie server found!',
      ip: getLocalIP(),
    });
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté');
  });
});

// Initialisation et démarrage des serveurs
async function startServer() {
  try {
    activeContainers = await initializeActiveContainers();
    console.log('Liste initialisée des conteneurs actifs :', activeContainers);

    httpServer.listen(3001, () => {
      const localIP = getLocalIP();
      console.log(`HTTP Server running on http://${localIP}:3001`);
    });
  } catch (err) {
    console.error('Erreur lors de l\'initialisation du serveur :', err);
  }
}

startServer();
