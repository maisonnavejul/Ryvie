const express = require('express');
const cors = require('cors');
const http = require('http'); // Nécessaire pour utiliser le serveur HTTP avec Socket.io
const { Server } = require('socket.io');
const os = require('os'); // Nécessaire pour récupérer l'adresse IP du Wi-Fi

const app = express();
const server = http.createServer(app); // Crée un serveur HTTP
const io = new Server(server, {
  cors: {
    origin: "*", // Autorise toutes les origines
    methods: ["GET", "POST"]
  }
});

app.use(cors()); // Autorise toutes les requêtes CORS

// Route HTTP simple
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

// Gérer les connexions WebSocket avec Socket.io
io.on('connection', (socket) => {
  console.log('Un client est connecté');
  socket.emit('status', { serverStatus: true });

  socket.on('disconnect', () => {
    console.log('Client déconnecté');
  });
});

// Fonction pour récupérer l'adresse IP locale de la carte réseau Wi-Fi
function getWifiIP() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    for (const addressInfo of addresses) {
      if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
        // Vérifie si c'est une interface Wi-Fi (généralement "Wi-Fi" ou similaire)
        if (interfaceName.toLowerCase().includes('wi') || interfaceName.toLowerCase().includes('wifi')) {
          return addressInfo.address; // Retourne l'adresse IPv4 non interne (Wi-Fi)
        }
      }
    }
  }
  return 'Wi-Fi IP not found';
}

// Lance le serveur sur le port 3000
server.listen(3000, () => {
  const wifiIP = getWifiIP();
  console.log(`Server running on http://${wifiIP}:3000`);
});
