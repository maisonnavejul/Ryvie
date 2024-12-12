const dgram = require('dgram');
const client = dgram.createSocket('udp4');

client.bind(() => {
  client.setBroadcast(true); // Activer le mode broadcast
});

const message = Buffer.from('Who is Ryvie?');
let intervalId;

// Fonction pour envoyer des messages périodiquement
function sendBroadcast() {
  client.send(message, 0, message.length, 41234, '255.255.255.255', (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Broadcast message sent');
    }
  });
}

// Envoyer un message toutes les 5 secondes
intervalId = setInterval(sendBroadcast, 2500);

// Écoute des réponses
client.on('message', (msg, rinfo) => {
  console.log(`Received response: ${msg} from ${rinfo.address}:${rinfo.port}`);

  // Envoyer l'adresse IP au processus principal
  if (process.send) {
    process.send({ type: 'ryvie-ip', ip: rinfo.address });
  }

  // Arrêter le programme une fois une réponse reçue
  console.log('Réponse reçue, arrêt de l\'envoi de messages...');
  clearInterval(intervalId); // Arrêter l'envoi périodique
  client.close(); // Fermer le socket UDP
  process.exit(0); // Terminer le processus
});
