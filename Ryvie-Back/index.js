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

// Fonction pour récupérer l'adresse IP locale de n'importe quelle interface réseau non interne (Wi-Fi ou Ethernet)
function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    for (const addressInfo of addresses) {
      if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
        // Retourne l'adresse IPv4 non interne, que ce soit Wi-Fi ou Ethernet
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

