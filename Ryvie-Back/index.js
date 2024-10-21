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

// Gérer les connexions WebSocket avec Socket.io
io.on('connection', (socket) => {
  console.log('Un client est connecté');
  socket.emit('status', { serverStatus: true });

  // Fonction pour récupérer les noms des conteneurs Docker actifs
  docker.listContainers((err, containers) => {
    if (err) {
      console.error('Erreur lors de la récupération des conteneurs Docker', err);
      socket.emit('error', { message: 'Erreur lors de la récupération des conteneurs Docker' });
      return;
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

    console.log('Noms des conteneurs actifs:', containerNames);

    // Envoyer les noms des conteneurs au client via WebSocket
    socket.emit('containers', { activeContainers: containerNames });
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
