// Importer le module Express
const express = require('express');

// Initialiser une application Express
const app = express();

// Définir le port sur lequel le serveur écoute
const port = 3000;

// Ajouter un middleware pour traiter les requêtes JSON
app.use(express.json());

// Créer une route GET de base
app.get('/', (req, res) => {
  res.send('Bienvenue sur mon serveur Express!');
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur Express.js en cours d'exécution sur le port ${port}`);
});
