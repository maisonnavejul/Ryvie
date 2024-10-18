const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // Autorise toutes les requêtes cross-origin

app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

app.listen(3000, () => {
  console.log('Server running on http://192.168.1.39:3000');
});
