const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Secret pour signer les tokens JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dQMsVQS39XkJRCHsAhJn3Hn2';

// Vérifie si le token est valide
const verifyToken = (req, res, next) => {
  // Récupérer le token de l'en-tête Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ 
      error: 'Accès refusé. Authentification requise.' 
    });
  }

  try {
    // Vérifier le token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Ajouter l'utilisateur décodé à l'objet request pour une utilisation ultérieure
    req.user = decoded;
    
    next(); // Passer au middleware suivant
  } catch (error) {
    console.error('Erreur de vérification du token:', error);
    return res.status(401).json({ 
      error: 'Token invalide ou expiré' 
    });
  }
};

// Vérifie si l'utilisateur est admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'Admin') {
    next();
  } else {
    return res.status(403).json({ 
      error: 'Accès refusé. Droits d\'administrateur requis.' 
    });
  }
};

// Vérifie si l'utilisateur a une permission spécifique
const hasPermission = (permission) => {
  return (req, res, next) => {
    // Définir les permissions par rôle
    const permissions = {
      Admin: ['manage_users', 'manage_apps', 'view_server_info', 'access_settings'],
      User: ['view_server_info'],
      Guest: []
    };

    // Vérifier si l'utilisateur a la permission requise
    if (req.user && permissions[req.user.role] && permissions[req.user.role].includes(permission)) {
      next();
    } else {
      return res.status(403).json({ 
        error: `Accès refusé. Permission '${permission}' requise.` 
      });
    }
  };
};

module.exports = {
  verifyToken,
  isAdmin,
  hasPermission,
  JWT_SECRET
};
