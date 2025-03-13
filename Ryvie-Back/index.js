const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const Docker = require('dockerode');
const diskusage = require('diskusage');
const path = require('path');
const ldap = require('ldapjs');

const docker = new Docker();
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
};

// Liste des conteneurs actifs
let activeContainers = [];
let isServerDetected = false;

// Fonction pour récupérer les conteneurs Docker actifs
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
const osutils = require('os-utils');

async function getServerInfo() {
  const totalRam = os.totalmem();
  const freeRam = os.freemem();
  const ramUsagePercentage = (((totalRam - freeRam) / totalRam) * 100).toFixed(1);

  const diskInfo = diskusage.checkSync(path.parse(__dirname).root);
  const totalDiskGB = (diskInfo.total / 1e9).toFixed(1);
  const usedDiskGB = ((diskInfo.total - diskInfo.free) / 1e9).toFixed(1);

  const cpuUsagePercentage = await new Promise((resolve) => {
    osutils.cpuUsage((usage) => {
      resolve((usage * 100).toFixed(1));
    });
  });

  return {
    stockage: {
      utilise: `${usedDiskGB} GB`,
      total: `${totalDiskGB} GB`,
    },
    performance: {
      cpu: `${cpuUsagePercentage}%`,
      ram: `${ramUsagePercentage}%`,
    },
  };
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
      const containerName = event.Actor.Attributes.name;
      if (event.Action === 'start') {
        if (!activeContainers.includes(containerName)) {
          activeContainers.push(containerName);
        }
      } else if (event.Action === 'stop') {
        activeContainers = activeContainers.filter((name) => name !== containerName);
      }
      io.emit('containers', { activeContainers });
    }
  });
});

// LDAP Configuration
const ldapConfig = {
  url: 'ldap://localhost:389',
  bindDN: 'cn=read-only,ou=users,dc=example,dc=org',
  bindPassword: 'Wimereux',
  userSearchBase: 'ou=users,dc=example,dc=org',
  groupSearchBase: 'ou=users,dc=example,dc=org',
  userFilter: '(objectClass=inetOrgPerson)',
  groupFilter: '(objectClass=groupOfNames)',
  adminGroup: 'cn=admins,ou=users,dc=example,dc=org',
  userGroup: 'cn=users,ou=users,dc=example,dc=org',
  guestGroup: 'cn=guests,ou=users,dc=example,dc=org',
};

// Fonction pour déterminer le rôle
function getRole(dn, groupMemberships) {
  if (groupMemberships.includes(ldapConfig.adminGroup)) return 'Admin';
  if (groupMemberships.includes(ldapConfig.userGroup)) return 'User';
  if (groupMemberships.includes(ldapConfig.guestGroup)) return 'Guest';
  return 'Unknown';
}

// Endpoint : Récupérer les utilisateurs LDAP
app.get('/api/users', async (req, res) => {
  const ldapClient = ldap.createClient({ url: ldapConfig.url });

  ldapClient.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
    if (err) {
      console.error('Échec de la connexion LDAP :', err);
      res.status(500).json({ error: 'Échec de la connexion LDAP' });
      return;
    }

    const ldapUsers = [];
    ldapClient.search(
      ldapConfig.userSearchBase,
      { filter: ldapConfig.userFilter, scope: 'sub', attributes: ['cn', 'uid', 'mail', 'dn'] },
      (err, ldapRes) => {
        if (err) {
          console.error('Erreur de recherche LDAP :', err);
          res.status(500).json({ error: 'Erreur de recherche LDAP' });
          return;
        }

        ldapRes.on('searchEntry', (entry) => {
          try {
            const cn = entry.pojo.attributes.find(attr => attr.type === 'cn')?.values[0] || 'Nom inconnu';
            const uid = entry.pojo.attributes.find(attr => attr.type === 'uid')?.values[0] || 'UID inconnu';
            const mail = entry.pojo.attributes.find(attr => attr.type === 'mail')?.values[0] || 'Email inconnu';
            const dn = entry.pojo.objectName;

            // Exclure l'utilisateur `read-only`
            if (uid !== 'read-only') {
              ldapUsers.push({ dn, name: cn, uid, email: mail });
            }
          } catch (err) {
            console.error('Erreur lors du traitement de l\'entrée LDAP :', err);
          }
        });

        ldapRes.on('end', () => {
          console.log('Recherche utilisateur terminée. Vérification des rôles...');
          const roles = {};

          ldapClient.search(
            ldapConfig.groupSearchBase,
            { filter: ldapConfig.groupFilter, scope: 'sub', attributes: ['cn', 'member'] },
            (err, groupRes) => {
              if (err) {
                console.error('Erreur lors de la recherche des groupes LDAP :', err);
                res.status(500).json({ error: 'Erreur lors de la recherche des groupes LDAP' });
                return;
              }

              groupRes.on('searchEntry', (groupEntry) => {
                const groupName = groupEntry.pojo.attributes.find(attr => attr.type === 'cn')?.values[0];
                const members = groupEntry.pojo.attributes.find(attr => attr.type === 'member')?.values || [];

                members.forEach((member) => {
                  if (!roles[member]) roles[member] = [];
                  roles[member].push(groupEntry.pojo.objectName);
                });
              });

              groupRes.on('end', () => {
                console.log('Recherche des groupes terminée.');

                const usersWithRoles = ldapUsers.map(user => ({
                  ...user,
                  role: getRole(user.dn, roles[user.dn] || []),
                }));

                console.log('Utilisateurs avec rôles :', usersWithRoles);
                res.json(usersWithRoles);
                ldapClient.unbind();
              });
            }
          );
        });
      }
    );
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
app.get('/api/server-info', async (req, res) => {
  try {
    const serverInfo = await getServerInfo();
    res.json(serverInfo);
  } catch (error) {
    console.error('Erreur lors de la récupération des infos serveur :', error);
    res.status(500).json({ error: "Impossible de récupérer les infos serveur" });
  }
});

io.on('connection', async (socket) => {
  console.log('Un client est connecté');

  socket.emit('status', { serverStatus: true });
  socket.emit('containers', { activeContainers });

  socket.on('discover', () => {
    isServerDetected = true;
    io.emit('server-detected', { message: 'Ryvie server found!', ip: getLocalIP() });
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

    httpServer.listen(3002, () => {
      console.log(`HTTP Server running on http://${getLocalIP()}:3002`);
    });
  } catch (err) {
    console.error('Erreur lors de l\'initialisation du serveur :', err);
  }
}

startServer();
