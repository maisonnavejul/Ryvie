import axios from 'axios';
import { logout } from '../services/authService';
import { getServerUrl } from '../config/urls';

// Fonction pour vérifier si le token est valide
export const verifyToken = async () => {
  try {
    const token = localStorage.getItem('jwt_token');
    if (!token) return false;
    
    const accessMode = localStorage.getItem('accessMode') || 'private';
    const serverUrl = getServerUrl(accessMode);
    
    // Appel au serveur pour vérifier la validité du token
    await axios.get(`${serverUrl}/api/users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return true; // Si aucune erreur n'est levée, le token est valide
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Token invalide ou expiré
      handleTokenError();
      return false;
    }
    // Autres erreurs (serveur non disponible, etc.)
    return false;
  }
};

// Fonction pour gérer les erreurs de token
export const handleTokenError = () => {
  console.log('Token expiré ou invalide, redirection vers la page de connexion');
  
  // Nettoyer les données d'authentification mais garder le mode d'accès
  const accessMode = localStorage.getItem('accessMode') || 'private';
  logout();
  localStorage.setItem('accessMode', accessMode); // Restaurer le mode d'accès
  
  // Rediriger vers la page de connexion
  if (window.electronAPI) {
    // Dans un environnement Electron, ouvrir une nouvelle fenêtre de connexion
    window.electronAPI.invoke('create-user-window-with-mode', 'userlogin', accessMode, 'User');
    // Fermer la fenêtre actuelle après un court délai pour permettre à la nouvelle fenêtre de s'ouvrir
    setTimeout(() => {
      window.electronAPI.closeCurrentWindow();
    }, 500);
  } else {
    // Dans un environnement navigateur
    window.location.href = '/userlogin';
  }
};

// Configuration des délais de timeout pour les requêtes axios
// Augmenter les timeouts pour le mode privé pour donner plus de temps au serveur local de répondre
axios.interceptors.request.use(request => {
  const accessMode = localStorage.getItem('accessMode') || 'private';
  
  // Augmenter le timeout pour le mode privé car le serveur local peut prendre plus de temps à répondre
  if (accessMode === 'private') {
    request.timeout = 10000; // 10 secondes pour le mode privé
  } else {
    request.timeout = 5000; // 5 secondes pour le mode public
  }
  
  return request;
}, error => {
  return Promise.reject(error);
});

// Intercepteur pour gérer les erreurs d'authentification
axios.interceptors.response.use(
  response => response,
  error => {
    // Si l'erreur est de type 401 (Unauthorized), cela signifie que le token est expiré ou invalide
    if (error.response && error.response.status === 401) {
      handleTokenError();
    }
    
    return Promise.reject(error);
  }
);

export default axios;
