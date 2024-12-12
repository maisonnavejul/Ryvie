const dgram = require('dgram');
const client = dgram.createSocket('udp4');

client.bind(() => {
  client.setBroadcast(true); // Activer le mode broadcast
});

const message = Buffer.from('Who is Ryvie?');
client.send(message, 0, message.length, 41234, '255.255.255.255', (err) => {
  if (err) console.error(err);
  else console.log('Broadcast message sent');
});

client.on('message', (msg, rinfo) => {
  console.log(`Received response: ${msg} from ${rinfo.address}:${rinfo.port}`);

  // Envoyer l'adresse IP au processus principal
  if (process.send) {
    process.send({ type: 'ryvie-ip', ip: rinfo.address });
  }
});
