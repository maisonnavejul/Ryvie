const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const Docker = require('dockerode');
const diskusage = require('diskusage');
const path = require('path');
const ldap = require('ldapjs');
const si = require('systeminformation');
const osutils = require('os-utils');

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
  'rcloud': 'Cloud',
  'portainer': 'Portainer',
  'rtransfer': 'rTransfer',
  'rdrop': 'rDrop',
  'rpictures': 'rPictures',
};

// Fonction pour extraire le nom de l'application à partir du nom du conteneur
function extractAppName(containerName) {
  // Vérifier si le conteneur commence par 'app-'
  if (containerName.startsWith('app-')) {
    // Extraire la partie après 'app-'
    const appNameWithSuffix = containerName.substring(4);
    // Extraire la partie avant le prochain tiret ou prendre tout si pas de tiret
    const dashIndex = appNameWithSuffix.indexOf('-');
    if (dashIndex > 0) {
      return appNameWithSuffix.substring(0, dashIndex);
    }
    return appNameWithSuffix;
  }
  // Pour les conteneurs qui ne commencent pas par 'app-', retourner null
  return null;
}

// Fonction pour récupérer tous les conteneurs Docker (actifs et inactifs)
async function getAllContainers() {
  return new Promise((resolve, reject) => {
    docker.listContainers({ all: true }, (err, containers) => {
      if (err) return reject(err);
      resolve(containers);
    });
  });
}

// Fonction pour récupérer les conteneurs Docker actifs
async function initializeActiveContainers() {
  return new Promise((resolve, reject) => {
    docker.listContainers({ all: false }, (err, containers) => {
      if (err) return reject(err);

      const containerNames = containers.map((container) => {
        return container.Names[0].replace('/', '');
      });

      console.log('Liste initialisée des conteneurs actifs :', containerNames);
      resolve(containerNames);
    });
  });
}

// Fonction pour regrouper les conteneurs par application
async function getAppStatus() {
  try {
    const containers = await getAllContainers();
    const apps = {};
    
    // Regrouper les conteneurs par application
    containers.forEach(container => {
      const containerName = container.Names[0].replace('/', '');
      const appName = extractAppName(containerName);
      
      // Si ce n'est pas un conteneur d'application, ignorer
      if (!appName) return;
      
      // Créer l'entrée de l'application si elle n'existe pas
      if (!apps[appName]) {
        // Utiliser le nom personnalisé s'il existe, sinon utiliser le nom extrait
        const displayName = containerMapping[appName] || appName;
        apps[appName] = {
          id: `app-${appName}`,
          name: displayName,
          containers: [],
          running: false,
          total: 0,
          active: 0,
          ports: []
        };
      }
      
      // Ajouter le conteneur à l'application
      apps[appName].total++;
      if (container.State === 'running') {
        apps[appName].active++;
        
        // Collecter les ports exposés
        if (container.Ports && container.Ports.length > 0) {
          container.Ports.forEach(port => {
            if (port.PublicPort && !apps[appName].ports.includes(port.PublicPort)) {
              apps[appName].ports.push(port.PublicPort);
            }
          });
        }
      }
      
      apps[appName].containers.push({
        id: container.Id,
        name: containerName,
        state: container.State,
        status: container.Status
      });
    });
    
    // Déterminer si l'application est considérée comme "running"
    // Une application est "running" seulement si TOUS ses conteneurs sont actifs
    for (const appName in apps) {
      const app = apps[appName];
      app.running = app.total > 0 && app.active === app.total;
    }
    
    // Formater la sortie finale
    return Object.values(apps).map(app => ({
      id: app.id,
      name: app.name,
      status: app.running ? 'running' : 'stopped',
      progress: app.total > 0 ? Math.round((app.active / app.total) * 100) : 0,
      containersRunning: `${app.active}/${app.total}`,
      ports: app.ports.sort((a, b) => a - b), // Trier les ports
      containers: app.containers
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération du statut des applications:', error);
    throw error;
  }
}

// Fonction pour démarrer une application (tous ses conteneurs)
async function startApp(appId) {
  try {
    const containers = await getAllContainers();
    let startedCount = 0;
    let failedCount = 0;
    
    // Filtrer les conteneurs appartenant à cette application
    const appContainers = containers.filter(container => {
      const containerName = container.Names[0].replace('/', '');
      return containerName.startsWith(appId);
    });
    
    if (appContainers.length === 0) {
      throw new Error(`Aucun conteneur trouvé pour l'application ${appId}`);
    }
    
    // Démarrer chaque conteneur arrêté
    for (const container of appContainers) {
      if (container.State !== 'running') {
        try {
          const containerObj = docker.getContainer(container.Id);
          await containerObj.start();
          startedCount++;
        } catch (err) {
          console.error(`Erreur lors du démarrage du conteneur ${container.Names[0]}:`, err);
          failedCount++;
        }
      }
    }
    
    return {
      success: failedCount === 0,
      message: `${startedCount} conteneur(s) démarré(s), ${failedCount} échec(s)`,
      appId
    };
  } catch (error) {
    console.error(`Erreur lors du démarrage de l'application ${appId}:`, error);
    throw error;
  }
}

// Fonction pour arrêter une application (tous ses conteneurs)
async function stopApp(appId) {
  try {
    const containers = await getAllContainers();
    let stoppedCount = 0;
    let failedCount = 0;
    
    // Filtrer les conteneurs appartenant à cette application
    const appContainers = containers.filter(container => {
      const containerName = container.Names[0].replace('/', '');
      return containerName.startsWith(appId);
    });
    
    if (appContainers.length === 0) {
      throw new Error(`Aucun conteneur trouvé pour l'application ${appId}`);
    }
    
    // Arrêter chaque conteneur en cours d'exécution
    for (const container of appContainers) {
      if (container.State === 'running') {
        try {
          const containerObj = docker.getContainer(container.Id);
          await containerObj.stop();
          stoppedCount++;
        } catch (err) {
          console.error(`Erreur lors de l'arrêt du conteneur ${container.Names[0]}:`, err);
          failedCount++;
        }
      }
    }
    
    return {
      success: failedCount === 0,
      message: `${stoppedCount} conteneur(s) arrêté(s), ${failedCount} échec(s)`,
      appId
    };
  } catch (error) {
    console.error(`Erreur lors de l'arrêt de l'application ${appId}:`, error);
    throw error;
  }
}

// Fonction pour redémarrer une application (tous ses conteneurs)
async function restartApp(appId) {
  try {
    const containers = await getAllContainers();
    let restartedCount = 0;
    let failedCount = 0;
    
    // Filtrer les conteneurs appartenant à cette application
    const appContainers = containers.filter(container => {
      const containerName = container.Names[0].replace('/', '');
      return containerName.startsWith(appId);
    });
    
    if (appContainers.length === 0) {
      throw new Error(`Aucun conteneur trouvé pour l'application ${appId}`);
    }
    
    // Redémarrer chaque conteneur
    for (const container of appContainers) {
      try {
        const containerObj = docker.getContainer(container.Id);
        if (container.State === 'running') {
          await containerObj.restart();
        } else {
          await containerObj.start();
        }
        restartedCount++;
      } catch (err) {
        console.error(`Erreur lors du redémarrage du conteneur ${container.Names[0]}:`, err);
        failedCount++;
      }
    }
    
    return {
      success: failedCount === 0,
      message: `${restartedCount} conteneur(s) redémarré(s), ${failedCount} échec(s)`,
      appId
    };
  } catch (error) {
    console.error(`Erreur lors du redémarrage de l'application ${appId}:`, error);
    throw error;
  }
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

// Fonction pour récupérer les informations du serveur
async function getServerInfo() {
  // 1) Mémoire
  const totalRam = os.totalmem();
  const freeRam = os.freemem();
  const ramUsagePercentage = (((totalRam - freeRam) / totalRam) * 100).toFixed(1);

  // 2) Disques
  const diskLayout = await si.diskLayout();
  const fsSizes = await si.fsSize();

  // 3) Compose la réponse disque par disque (sans 'type')
  const disks = diskLayout.map(d => {
    const totalBytes = d.size;
    const parts = fsSizes.filter(f =>
      f.fs && f.fs.startsWith(d.device)
    );
    const mounted = parts.length > 0;
    const usedBytes = parts.reduce((sum, p) => sum + p.used, 0);
    const freeBytes = totalBytes - usedBytes;

    return {
      device: d.device,                         // ex: '/dev/sda'
      size: `${(totalBytes / 1e9).toFixed(1)} GB`,
      used: `${(usedBytes / 1e9).toFixed(1)} GB`,
      free: `${(freeBytes / 1e9).toFixed(1)} GB`,
      mounted: mounted
    };
  });

  // 4) Totaux globaux (uniquement pour les disques montés)
  const mountedDisks = disks.filter(d => d.mounted);
  const totalSize = mountedDisks.reduce((sum, d) => sum + parseFloat(d.size), 0);
  const totalUsed = mountedDisks.reduce((sum, d) => sum + parseFloat(d.used), 0);
  const totalFree = mountedDisks.reduce((sum, d) => sum + parseFloat(d.free), 0);
  
  // 5) CPU
  const cpuUsagePercentage = await new Promise(resolve => {
    osutils.cpuUsage(u => resolve((u * 100).toFixed(1)));
  });
  
  return {
    stockage: {
      utilise: `${totalUsed.toFixed(1)} GB`,
      total: `${totalSize.toFixed(1)} GB`,
    },
    performance: {
      cpu: `${cpuUsagePercentage}%`,
      ram: `${ramUsagePercentage}%`,
    },
  };
}

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

// Endpoint : Authentification utilisateur LDAP
app.use(express.json()); // Pour parser le JSON dans les requêtes POST

app.post('/api/authenticate', (req, res) => {
  const { uid, password } = req.body;

  if (!uid || !password) {
    return res.status(400).json({ error: 'UID et mot de passe requis' });
  }

  const ldapClient = ldap.createClient({ url: ldapConfig.url });

  // Première connexion pour rechercher le DN utilisateur
  ldapClient.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
    if (err) {
      console.error('Erreur de connexion LDAP initiale:', err);
      return res.status(500).json({ error: 'Échec de connexion LDAP initiale' });
    }

    const userFilter = `(&(uid=${uid})${ldapConfig.userFilter})`;

    ldapClient.search(ldapConfig.userSearchBase, {
      filter: userFilter,
      scope: 'sub',
      attributes: ['dn', 'cn', 'mail', 'uid'],
    }, (err, ldapRes) => {
      if (err) {
        console.error('Erreur de recherche utilisateur LDAP:', err);
        return res.status(500).json({ error: 'Erreur de recherche utilisateur' });
      }

      let userEntry;

      ldapRes.on('searchEntry', (entry) => {
        userEntry = entry;
      });

      ldapRes.on('end', () => {
        if (!userEntry) {
          ldapClient.unbind();
          return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        const userDN = userEntry.pojo.objectName;

        // Tente de connecter l'utilisateur avec son propre DN et mot de passe
        const userAuthClient = ldap.createClient({ url: ldapConfig.url });
        userAuthClient.bind(userDN, password, (err) => {
          if (err) {
            console.error('Échec de l\'authentification utilisateur:', err);
            ldapClient.unbind();
            return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
          }

          // Authentification réussie
          ldapClient.unbind();
          userAuthClient.unbind();

          const user = {
            dn: userDN,
            uid: userEntry.pojo.attributes.find(attr => attr.type === 'uid')?.values[0],
            name: userEntry.pojo.attributes.find(attr => attr.type === 'cn')?.values[0],
            email: userEntry.pojo.attributes.find(attr => attr.type === 'mail')?.values[0],
          };

          res.json({ message: 'Authentification réussie', user });
        });
      });
    });
  });
});

app.post('/api/add-user', async (req, res) => {
  const { adminUid, adminPassword, newUser } = req.body;

  if (!adminUid || !adminPassword || !newUser || !newUser.role) {
    return res.status(400).json({ error: 'Champs requis manquants (adminUid, adminPassword, newUser, role)' });
  }

  const ldapClient = ldap.createClient({ url: ldapConfig.url });

  // Étape 1 : Connexion initiale en read-only
  ldapClient.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
    if (err) {
      console.error('Erreur connexion LDAP initiale :', err);
      return res.status(500).json({ error: 'Erreur de connexion LDAP initiale' });
    }

    // Étape 2 : Chercher DN de l’admin
    const adminFilter = `(&(uid=${adminUid})${ldapConfig.userFilter})`;
    ldapClient.search(ldapConfig.userSearchBase, {
      filter: adminFilter,
      scope: 'sub',
      attributes: ['dn'],
    }, (err, ldapRes) => {
      if (err) {
        console.error('Erreur recherche admin LDAP :', err);
        return res.status(500).json({ error: 'Erreur recherche admin LDAP' });
      }

      let adminEntry;
      ldapRes.on('searchEntry', entry => adminEntry = entry);

      ldapRes.on('end', () => {
        if (!adminEntry) {
          ldapClient.unbind();
          return res.status(401).json({ error: 'Admin non trouvé' });
        }

        const adminDN = adminEntry.pojo.objectName;
        const adminAuthClient = ldap.createClient({ url: ldapConfig.url });

        // Étape 3 : Authentifier l’admin
        adminAuthClient.bind(adminDN, adminPassword, (err) => {
          if (err) {
            console.error('Échec authentification admin:', err);
            ldapClient.unbind();
            return res.status(401).json({ error: 'Authentification Admin échouée' });
          }

          // Étape 4 : Vérifier si l’admin est bien dans le groupe admins
          ldapClient.search(ldapConfig.adminGroup, {
            filter: `(member=${adminDN})`,
            scope: 'base',
            attributes: ['cn'],
          }, (err, roleRes) => {
            let isAdmin = false;
            roleRes.on('searchEntry', () => isAdmin = true);

            roleRes.on('end', () => {
              if (!isAdmin) {
                ldapClient.unbind();
                adminAuthClient.unbind();
                return res.status(403).json({ error: 'Droits admin requis' });
              }

              // Étape 5 : Vérifier UID ou email déjà utilisé
              const checkFilter = `(|(uid=${newUser.uid})(mail=${newUser.mail}))`;
              ldapClient.search(ldapConfig.userSearchBase, {
                filter: checkFilter,
                scope: 'sub',
                attributes: ['uid', 'mail'],
              }, (err, checkRes) => {
                if (err) {
                  console.error('Erreur vérification UID/email existants :', err);
                  return res.status(500).json({ error: 'Erreur lors de la vérification de l’utilisateur' });
                }

                let conflict = null;
                checkRes.on('searchEntry', (entry) => {
                  const entryUid = entry.pojo.attributes.find(attr => attr.type === 'uid')?.values[0];
                  const entryMail = entry.pojo.attributes.find(attr => attr.type === 'mail')?.values[0];
                  if (entryUid === newUser.uid) conflict = 'UID';
                  else if (entryMail === newUser.mail) conflict = 'email';
                });

                checkRes.on('end', () => {
                  if (conflict) {
                    ldapClient.unbind();
                    adminAuthClient.unbind();
                    return res.status(409).json({ error: `Un utilisateur avec ce ${conflict} existe déjà.` });
                  }

                  // Étape 6 : Créer l'utilisateur
                  const newUserDN = `uid=${newUser.uid},${ldapConfig.userSearchBase}`;
                  const entry = {
                    cn: newUser.cn,
                    sn: newUser.sn,
                    uid: newUser.uid,
                    mail: newUser.mail,
                    objectClass: ['top', 'person', 'organizationalPerson', 'inetOrgPerson'],
                    userPassword: newUser.password,
                  };

                  adminAuthClient.add(newUserDN, entry, (err) => {
                    if (err) {
                      console.error('Erreur ajout utilisateur LDAP :', err);
                      ldapClient.unbind();
                      adminAuthClient.unbind();
                      return res.status(500).json({ error: 'Erreur ajout utilisateur LDAP' });
                    }

                    // Étape 7 : Ajouter dans le bon groupe
                    const roleGroup = {
                      Admin: ldapConfig.adminGroup,
                      User: ldapConfig.userGroup,
                      Guest: ldapConfig.guestGroup,
                    }[newUser.role];

                    if (!roleGroup) {
                      return res.status(400).json({ error: `Rôle inconnu : ${newUser.role}` });
                    }

                    const groupClient = ldap.createClient({ url: ldapConfig.url });
                    groupClient.bind(adminDN, adminPassword, (err) => {
                      if (err) {
                        console.error('Échec bind admin pour ajout au groupe');
                        return res.status(500).json({ error: 'Impossible d’ajouter au groupe' });
                      }

                      const change = new ldap.Change({
                        operation: 'add',
                        modification: new ldap.Attribute({
                          type: 'member',
                          values: [newUserDN],
                        }),
                      });

                      groupClient.modify(roleGroup, change, (err) => {
                        ldapClient.unbind();
                        adminAuthClient.unbind();
                        groupClient.unbind();

                        if (err && err.name !== 'AttributeOrValueExistsError') {
                          console.error('Erreur ajout au groupe :', err);
                          return res.status(500).json({ error: 'Utilisateur créé, mais échec d’ajout au groupe' });
                        }

                        return res.json({
                          message: `Utilisateur "${newUser.uid}" ajouté avec succès en tant que ${newUser.role}`,
                          user: {
                            cn: newUser.cn,
                            sn: newUser.sn,
                            uid: newUser.uid,
                            mail: newUser.mail,
                            role: newUser.role,
                          }
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

app.post('/api/delete-user', async (req, res) => {
  const { adminUid, adminPassword, uid } = req.body;

  if (!adminUid || !adminPassword || !uid) {
    return res.status(400).json({ error: 'adminUid, adminPassword et uid requis' });
  }

  const ldapClient = ldap.createClient({ url: ldapConfig.url });

  ldapClient.bind(ldapConfig.bindDN, ldapConfig.bindPassword, (err) => {
    if (err) {
      console.error('Erreur bind initial LDAP :', err);
      return res.status(500).json({ error: 'Connexion LDAP échouée' });
    }

    const adminFilter = `(&(uid=${adminUid})${ldapConfig.userFilter})`;

    ldapClient.search(ldapConfig.userSearchBase, {
      filter: adminFilter,
      scope: 'sub',
      attributes: ['dn'],
    }, (err, adminRes) => {
      if (err) {
        console.error('Erreur recherche admin :', err);
        return res.status(500).json({ error: 'Erreur recherche admin' });
      }

      let adminEntry;
      adminRes.on('searchEntry', entry => adminEntry = entry);

      adminRes.on('end', () => {
        if (!adminEntry) {
          ldapClient.unbind();
          return res.status(401).json({ error: 'Admin non trouvé' });
        }

        const adminDN = adminEntry.pojo.objectName;
        const adminAuthClient = ldap.createClient({ url: ldapConfig.url });

        adminAuthClient.bind(adminDN, adminPassword, (err) => {
          if (err) {
            console.error('Échec authentification admin :', err);
            ldapClient.unbind();
            return res.status(401).json({ error: 'Mot de passe admin incorrect' });
          }

          // Vérifie si l'admin est bien dans le groupe "admins"
          ldapClient.search(ldapConfig.adminGroup, {
            filter: `(member=${adminDN})`,
            scope: 'base',
            attributes: ['cn'],
          }, (err, groupRes) => {
            let isAdmin = false;
            groupRes.on('searchEntry', () => isAdmin = true);

            groupRes.on('end', () => {
              if (!isAdmin) {
                ldapClient.unbind();
                adminAuthClient.unbind();
                return res.status(403).json({ error: 'Accès refusé. Droits admin requis.' });
              }

              // Trouver l'utilisateur à supprimer
              ldapClient.search(ldapConfig.userSearchBase, {
                filter: `(uid=${uid})`,
                scope: 'sub',
                attributes: ['dn'],
              }, (err, userRes) => {
                if (err) {
                  console.error('Erreur recherche utilisateur à supprimer :', err);
                  return res.status(500).json({ error: 'Erreur recherche utilisateur' });
                }

                let userEntry;
                userRes.on('searchEntry', entry => userEntry = entry);

                userRes.on('end', () => {
                  if (!userEntry) {
                    ldapClient.unbind();
                    adminAuthClient.unbind();
                    return res.status(404).json({ error: 'Utilisateur non trouvé' });
                  }

                  const userDN = userEntry.pojo.objectName;

                  // Étape 1 : Supprimer des groupes
                  const removeFromGroups = [ldapConfig.adminGroup, ldapConfig.userGroup, ldapConfig.guestGroup];

                  const groupClient = ldap.createClient({ url: ldapConfig.url });
                  groupClient.bind(adminDN, adminPassword, (err) => {
                    if (err) {
                      console.error('Erreur bind pour nettoyage groupes');
                      return res.status(500).json({ error: 'Erreur de nettoyage groupes' });
                    }

                    let tasksDone = 0;
                    removeFromGroups.forEach(groupDN => {
                      const change = new ldap.Change({
                        operation: 'delete',
                        modification: new ldap.Attribute({
                          type: 'member',
                          values: [userDN],
                        }),
                      });

                      groupClient.modify(groupDN, change, (err) => {
                        // Silencieusement ignore si l'utilisateur n'était pas dans le groupe
                        tasksDone++;
                        if (tasksDone === removeFromGroups.length) {
                          // Étape 2 : Supprimer l'utilisateur
                          adminAuthClient.del(userDN, (err) => {
                            ldapClient.unbind();
                            adminAuthClient.unbind();
                            groupClient.unbind();

                            if (err) {
                              console.error('Erreur suppression utilisateur :', err);
                              return res.status(500).json({ error: 'Erreur suppression utilisateur' });
                            }

                            res.json({ message: `Utilisateur "${uid}" supprimé avec succès` });
                          });
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// Serveur HTTP pour signaler la détection du serveur
app.get('/status', (req, res) => {
  res.status(200).json({
    message: 'Server is running',
    serverDetected: false,
    ip: getLocalIP(),
  });
});

app.get('/api/server-info', async (req, res) => {
  try {
    const serverInfo = await getServerInfo();
    res.json(serverInfo);
  } catch (error) {
    console.error('Erreur lors de la récupération des informations du serveur :', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des informations' });
  }
});

app.get('/api/disks', async (req, res) => {
  try {
    // 1) Liste des disques physiques
    const diskLayout = await si.diskLayout();
    // 2) Liste des volumes montés
    const fsSizes    = await si.fsSize();

    // 3) Compose la réponse disque par disque
    const disks = diskLayout.map(d => {
      const totalBytes = d.size;
      const parts      = fsSizes.filter(f =>
        f.fs && f.fs.startsWith(d.device)
      );
      const mounted    = parts.length > 0;

      // Si monté, on calcule used/free ; sinon, on force à 0
      let usedBytes, freeBytes;
      if (mounted) {
        usedBytes = parts.reduce((sum, p) => sum + p.used, 0);
        freeBytes = totalBytes - usedBytes;
      } else {
        usedBytes = 0;
        freeBytes = 0;
      }

      return {
        device:  d.device,                         // ex: '/dev/sda'
        size:    `${(totalBytes / 1e9).toFixed(1)} GB`,
        used:    `${(usedBytes   / 1e9).toFixed(1)} GB`,
        free:    `${(freeBytes   / 1e9).toFixed(1)} GB`,
        mounted: mounted
      };
    });

    // 4) Totaux globaux (uniquement pour les disques montés)
    const mountedDisks = disks.filter(d => d.mounted);
    const totalSize = mountedDisks.reduce((sum, d) => sum + parseFloat(d.size), 0);
    const totalUsed = mountedDisks.reduce((sum, d) => sum + parseFloat(d.used), 0);
    const totalFree = mountedDisks.reduce((sum, d) => sum + parseFloat(d.free), 0);

    res.json({
      disks,
      total: {
        size: `${totalSize.toFixed(1)} GB`,
        used: `${totalUsed.toFixed(1)} GB`,
        free: `${totalFree.toFixed(1)} GB`
      }
    });
  } catch (err) {
    console.error('Erreur récupération info disques :', err);
    res.status(500).json({ error: 'Impossible de récupérer les informations de disques' });
  }
});

// Endpoint : Récupérer la liste des applications et leur statut
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await getAppStatus();
    res.status(200).json(apps);
  } catch (error) {
    console.error('Erreur lors de la récupération des applications :', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des applications' });
  }
});

// Endpoint : Démarrer une application
app.post('/api/apps/:id/start', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await startApp(id);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Erreur lors du démarrage de l'application ${id} :`, error);
    res.status(500).json({ 
      error: `Erreur serveur lors du démarrage de l'application`,
      message: error.message
    });
  }
});

// Endpoint : Arrêter une application
app.post('/api/apps/:id/stop', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await stopApp(id);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Erreur lors de l'arrêt de l'application ${id} :`, error);
    res.status(500).json({ 
      error: `Erreur serveur lors de l'arrêt de l'application`,
      message: error.message
    });
  }
});

// Endpoint : Redémarrer une application
app.post('/api/apps/:id/restart', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await restartApp(id);
    res.status(200).json(result);
  } catch (error) {
    console.error(`Erreur lors du redémarrage de l'application ${id} :`, error);
    res.status(500).json({ 
      error: `Erreur serveur lors du redémarrage de l'application`,
      message: error.message
    });
  }
});

// Liste des conteneurs actifs
let activeContainers = [];
let isServerDetected = false;

io.on('connection', async (socket) => {
  console.log('Un client est connecté');

  socket.emit('status', { serverStatus: true });
  socket.emit('containers', { activeContainers });

  socket.on('discover', () => {
    io.emit('server-detected', { message: 'Ryvie server found!', ip: getLocalIP() });
  });

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
      const containerName = event.Actor.Attributes.name;
      if (event.Action === 'start') {
        if (!activeContainers.includes(containerName)) {
          activeContainers.push(containerName);
        }
      } else if (event.Action === 'stop') {
        activeContainers = activeContainers.filter((name) => name !== containerName);
      }
      io.emit('containers', { activeContainers });
      
      // Émettre l'événement de mise à jour des applications
      // Cela permet au frontend de mettre à jour l'état des applications en temps réel
      getAppStatus().then(apps => {
        io.emit('apps-status-update', apps);
      }).catch(error => {
        console.error('Erreur lors de la mise à jour des statuts d\'applications:', error);
      });
    }
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