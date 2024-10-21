const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const Docker = require('dockerode'); // Nécessaire pour interagir avec Docker

const docker = new Docker(); // Crée une instance de Docker
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors()); 

// Route HTTP simple
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

// Correspondances des noms de conteneurs Docker avec des noms personnalisés
const containerMapping = {
  'nextcloud': 'Cloud',
  'portainer': 'Portainer',
  // Ajoutez d'autres correspondances ici si nécessaire
};

// Fonction pour récupérer les noms des conteneurs Docker actifs
async function getActiveContainers() {
  return new Promise((resolve, reject) => {
    docker.listContainers((err, containers) => {
      if (err) {
        return reject('Erreur lors de la récupération des conteneurs Docker', err);
      }

      // Extraire les noms des conteneurs et les mapper aux noms personnalisés
      const containerNames = containers.map(container => {
        const containerName = container.Names[0].replace('/', ''); // Retirer le '/' du nom

        // Vérifier si le conteneur correspond à un nom dans la correspondance
        for (const key in containerMapping) {
          if (containerName.toLowerCase().includes(key)) {
            return containerMapping[key];
          }
        }

        // Retourne le nom original si aucune correspondance n'est trouvée
        return containerName;
      });

      resolve(containerNames);
    });
  });
}

// Gérer les connexions WebSocket avec Socket.io
io.on('connection', async (socket) => {
  console.log('Un client est connecté');
  socket.emit('status', { serverStatus: true });

  // Envoyer la liste initiale des conteneurs Docker actifs dès la connexion
  try {
    const activeContainers = await getActiveContainers();
    console.log('Envoi de la liste actuelle des conteneurs actifs:', activeContainers);
    socket.emit('containers', { activeContainers });
  } catch (err) {
    console.error(err);
    socket.emit('error', { message: 'Erreur lors de la récupération des conteneurs Docker' });
  }

  // Écouter les événements Docker pour détecter les démarrages/arrêts de conteneurs
  docker.getEvents((err, stream) => {
    if (err) {
      console.error('Erreur lors de l\'écoute des événements Docker', err);
      return;
    }

    stream.on('data', async (data) => {
      const event = JSON.parse(data.toString());

      // Filtrer uniquement les événements de démarrage ou d'arrêt de conteneur
      if (event.Type === 'container' && (event.Action === 'start' || event.Action === 'stop')) {
        console.log(`Événement Docker capturé: ${event.Action} pour ${event.Actor.Attributes.name}`);

        try {
          // Mettre à jour la liste des conteneurs actifs après chaque événement pertinent
          const updatedActiveContainers = await getActiveContainers();
          socket.emit('containers', { activeContainers: updatedActiveContainers });
        } catch (err) {
          console.error('Erreur lors de la mise à jour des conteneurs actifs', err);
        }
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté');
  });
});

// Fonction pour récupérer l'adresse IP locale de n'importe quelle interface réseau non interne (Wi-Fi ou Ethernet)
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

server.listen(3001, () => { 
  const localIP = getLocalIP();
  console.log(`Server running on http://${localIP}:3001`); 
});
