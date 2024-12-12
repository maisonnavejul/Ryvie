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

// Fonction pour récupérer les conteneurs Docker actifs
async function getActiveContainers() {
  return new Promise((resolve, reject) => {
    docker.listContainers((err, containers) => {
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
  socket.emit('status', { serverStatus: true });

  try {
    const activeContainers = await getActiveContainers();
    socket.emit('containers', { activeContainers });
  } catch (err) {
    console.error(err);
    socket.emit('error', { message: 'Erreur lors de la récupération des conteneurs Docker' });
  }

  docker.getEvents((err, stream) => {
    if (err) {
      console.error('Erreur lors de l\'écoute des événements Docker', err);
      return;
    }

    stream.on('data', async (data) => {
      const event = JSON.parse(data.toString());
      if (event.Type === 'container' && (event.Action === 'start' || event.Action === 'stop')) {
        console.log(`Événement Docker: ${event.Action} pour ${event.Actor.Attributes.name}`);
        try {
          const updatedActiveContainers = await getActiveContainers();
          socket.emit('containers', { activeContainers: updatedActiveContainers });
        } catch (err) {
          console.error(err);
        }
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté');
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

// Démarrage des serveurs
httpServer.listen(3001, () => {
  const localIP = getLocalIP();
  console.log(`HTTP Server running on http://${localIP}:3001`);
});

// Démarrage du serveur UDP
udpServer.bind(41234, () => {
  udpServer.setBroadcast(true);
});
