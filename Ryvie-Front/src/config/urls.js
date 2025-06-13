/**
 * Configuration centralisée des URLs pour l'application Ryvie
 * Ce fichier contient toutes les URLs utilisées dans l'application,
 * avec leurs versions publiques et privées.
 */

// URLs de base pour les API et services
const BASE_URLS = {
  // URLs du serveur principal
  SERVER: {
    PUBLIC: 'https://status.makerfaire.jules.ryvie.fr',
    PRIVATE: 'http://ryvie.local:3002'
  },
  
  // URLs des applications
  APPS: {
    APP_STORE: {
      PUBLIC: 'https://appstore.makerfaire.jules.ryvie.fr',
      PRIVATE: 'http://ryvie.local:5173'
    },
    RCLOUD: {
      PUBLIC: 'https://rcloud.test.jules.ryvie.fr',
      PRIVATE: 'http://ryvie.local:3001'
    },
    PORTAINER: {
      PUBLIC: 'https://portainer.makerfaire.jules.ryvie.fr',
      PRIVATE: 'http://ryvie.local:9005'
    },
    OUTLINE: {
      PUBLIC: 'http://192.168.6.131/#/',
      PRIVATE: 'http://192.168.6.131/#/'
    },
    RTRANSFER: {
      PUBLIC: 'https://rtransfer.makerfaire.jules.ryvie.fr/auth/signIn',
      PRIVATE: 'http://ryvie.local:3000'
    },
    RDROP: {
      PUBLIC: 'https://rdrop.makerfaire.jules.ryvie.fr',
      PRIVATE: 'http://ryvie.local:8080'
    },
    RPictures: {
      PUBLIC: 'https://rpictures.makerfaire.jules.ryvie.fr',
      PRIVATE: 'http://ryvie.local:2283'
    },
    HOMEASSISTANT: {
      PUBLIC: 'https://homeassistant.makerfaire.jules.ryvie.fr',
      PRIVATE: 'http://ryvie.local:3000'
    }
  }
};

/**
 * Fonction utilitaire pour obtenir l'URL appropriée en fonction du mode d'accès
 * @param {Object} urlConfig - Configuration d'URL avec propriétés PUBLIC et PRIVATE
 * @param {string} accessMode - Mode d'accès ('public' ou 'private')
 * @returns {string} - L'URL appropriée selon le mode d'accès
 */
const getUrl = (urlConfig, accessMode) => {
  return accessMode === 'public' ? urlConfig.PUBLIC : urlConfig.PRIVATE;
};

/**
 * Fonction pour obtenir l'URL du serveur en fonction du mode d'accès
 * @param {string} accessMode - Mode d'accès ('public' ou 'private')
 * @returns {string} - L'URL du serveur
 */
const getServerUrl = (accessMode) => {
  return getUrl(BASE_URLS.SERVER, accessMode);
};

/**
 * Fonction pour obtenir l'URL d'une application en fonction du mode d'accès
 * @param {string} appName - Nom de l'application (doit correspondre à une clé dans APPS)
 * @param {string} accessMode - Mode d'accès ('public' ou 'private')
 * @returns {string} - L'URL de l'application
 */
const getAppUrl = (appName, accessMode) => {
  if (!BASE_URLS.APPS[appName]) {
    console.error(`Application non trouvée: ${appName}`);
    return '';
  }
  return getUrl(BASE_URLS.APPS[appName], accessMode);
};

// Exporter les fonctions et constantes en utilisant module.exports (CommonJS)
module.exports = {
  BASE_URLS,
  getUrl,
  getServerUrl,
  getAppUrl
};
