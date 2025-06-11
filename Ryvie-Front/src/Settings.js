import React, { useState, useEffect } from 'react';
import './styles/Settings.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer, faHdd, faDatabase, faPlug } from '@fortawesome/free-solid-svg-icons';
import io from 'socket.io-client'; // Importer la bibliothèque Socket.IO
const { getServerUrl } = require('./config/urls');

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [serverInfoLoading, setServerInfoLoading] = useState(true);
  const [stats, setStats] = useState({
    storageUsed: 0,
    storageLimit: 1000, // Go - valeur par défaut pour éviter la division par zéro
    cpuUsage: 0,
    ramUsage: 0,
    activeUsers: 1,
    totalFiles: 110,
    backupStatus: 'Completed',
    lastBackup: '2024-01-09 14:30',
    lastUpdated: null, // Timestamp de la dernière mise à jour réussie
  });

  const [settings, setSettings] = useState({
    autoBackup: true,
    backupFrequency: 'daily',
    encryptionEnabled: true,
    twoFactorAuth: false,
    notificationsEnabled: true,
    darkMode: false,
    compressionLevel: 'medium',
    bandwidthLimit: 'unlimited',
    autoDelete: false,
    autoDeletionPeriod: '30',
    storageLocation: 'hybrid',  // Modifié de 'local' à 'hybrid' comme demandé
    redundancyLevel: 'raid1',
    downloadPath: '',
  });

  // État pour les applications Docker
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState(null);
  const [appActionStatus, setAppActionStatus] = useState({
    show: false,
    success: false,
    message: '',
    appId: null
  });
  // État pour l'application sélectionnée (détails)
  const [selectedApp, setSelectedApp] = useState(null);

  const [disks, setDisks] = useState([
    {
      id: 1,
      name: 'Disque 1',
      size: '2TB',
      used: '800GB',
      health: 'good',
      type: 'SSD',
      status: 'active',
    },
    {
      id: 2,
      name: 'Disque 2',
      size: '2TB',
      used: '750GB',
      health: 'good',
      type: 'SSD',
      status: 'active',
    },
  ]);

  const [ryvieServers, setRyvieServers] = useState([
    {
      id: 1,
      name: 'Serveur Paris',
      location: 'Paris, France',
      ping: '5ms',
      status: 'online',
    },
    {
      id: 2,
      name: 'Serveur Londres',
      location: 'London, UK',
      ping: '15ms',
      status: 'online',
    },
    {
      id: 3,
      name: 'Serveur New York',
      location: 'New York, USA',
      ping: '85ms',
      status: 'online',
    },
  ]);

  const [changeStatus, setChangeStatus] = useState({ show: false, success: false });
  const [accessMode, setAccessMode] = useState('private');
  const [systemDisksInfo, setSystemDisksInfo] = useState(null);
  const [showDisksInfo, setShowDisksInfo] = useState(false);

  const [socketConnected, setSocketConnected] = useState(false);
  const [serverConnectionStatus, setServerConnectionStatus] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Charger le dossier de téléchargement actuel
        const path = await window.electronAPI.getDownloadFolder();
        setSettings(prev => ({
          ...prev,
          downloadPath: path
        }));
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching settings:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Récupération des informations serveur avec cache intelligent
  useEffect(() => {
    // Récupère la valeur de accessMode depuis le localStorage
    const storedMode = localStorage.getItem('accessMode') || 'private';
    setAccessMode(storedMode);
    
    // Essayer de récupérer les infos serveur cachées du localStorage
    const cachedServerInfo = localStorage.getItem('cachedServerInfo');
    if (cachedServerInfo) {
      try {
        const parsedCache = JSON.parse(cachedServerInfo);
        // N'utiliser le cache que s'il date de moins de 5 minutes
        const cacheAge = Date.now() - parsedCache.timestamp;
        if (cacheAge < 5 * 60 * 1000) { // 5 minutes en millisecondes
          console.log('Utilisation des données serveur en cache pendant le chargement...');
          updateServerStats(parsedCache.data);
          setServerInfoLoading(false);
        }
      } catch (e) {
        console.warn('Cache serveur invalide, ignoré');
      }
    }
    
    // Détermine l'URL du serveur en fonction du mode d'accès
    const baseUrl = getServerUrl(storedMode);
    console.log("Connexion au serveur :", baseUrl);
    
    let isFirstFetch = true;
    
    // Fonction pour récupérer les informations serveur
    const fetchServerInfo = async () => {
      try {
        // Indiquer que nous chargeons les données serveur uniquement au premier chargement
        if (isFirstFetch) {
          setServerInfoLoading(true);
        }
        
        const startTime = performance.now();
        const response = await axios.get(`${baseUrl}/api/server-info`, {
          timeout: 3000, // Timeout de 3 secondes pour éviter les attentes trop longues
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const endTime = performance.now();
        
        console.log(`Informations serveur reçues en ${Math.round(endTime-startTime)}ms:`, response.data);
        
        // Mettre à jour les stats et enregistrer dans le cache local
        updateServerStats(response.data);
        
        // Sauvegarder dans le localStorage pour une utilisation future
        const cacheData = {
          timestamp: Date.now(),
          data: response.data
        };
        localStorage.setItem('cachedServerInfo', JSON.stringify(cacheData));
        
        // Nous avons maintenant des données fraîches
        setServerInfoLoading(false);
        isFirstFetch = false;
      } catch (error) {
        console.error('Erreur lors de la récupération des informations serveur:', error);
        // En cas d'erreur, ne plus indiquer le chargement pour éviter un indicateur de chargement infini
        setServerInfoLoading(false);
      }
    };
    
    // Appel initial
    fetchServerInfo();
    
    // Configuration de l'intervalle pour les mises à jour régulières
    // Utiliser un intervalle plus long pour réduire la charge sur le serveur
    const intervalId = setInterval(fetchServerInfo, 3000); // Passé de 2s à 3s
    
    // Nettoyage lors du démontage du composant
    return () => {
      clearInterval(intervalId);
    };
  }, [accessMode]); // Réexécute l'effet si le mode d'accès change

  // Fonction pour mettre à jour les statistiques du serveur avec transition fluide
  const updateServerStats = (data) => {
    if (!data) return;
    
    // Extraire les valeurs de stockage
    let storageUsed = 0;
    let storageTotal = 1000; // Valeur par défaut
    
    if (data.stockage) {
      // Convertir les valeurs de GB en nombre
      const usedMatch = data.stockage.utilise.match(/(\d+(\.\d+)?)/);
      const totalMatch = data.stockage.total.match(/(\d+(\.\d+)?)/);
      
      if (usedMatch && totalMatch) {
        storageUsed = parseFloat(usedMatch[0]);
        storageTotal = parseFloat(totalMatch[0]);
      }
    }
    
    // Extraire les valeurs de performance
    let cpuUsage = 30; // Valeur par défaut
    let ramUsage = 40; // Valeur par défaut
    
    if (data.performance) {
      // Convertir les pourcentages en nombres
      const cpuMatch = data.performance.cpu.match(/(\d+(\.\d+)?)/);
      const ramMatch = data.performance.ram.match(/(\d+(\.\d+)?)/);
      
      if (cpuMatch) cpuUsage = parseFloat(cpuMatch[0]);
      if (ramMatch) ramUsage = parseFloat(ramMatch[0]);
    }
    
    // Détecter si les valeurs ont changé de manière significative
    setStats(prev => {
      // Ne mettre à jour que si les valeurs ont changé de plus de 1% pour éviter les micro-mises à jour
      const shouldUpdateStorage = Math.abs(storageUsed - prev.storageUsed) > storageTotal * 0.01 || 
                                 Math.abs(storageTotal - prev.storageLimit) > prev.storageLimit * 0.01;
      
      const shouldUpdateCPU = Math.abs(cpuUsage - prev.cpuUsage) > 1;
      const shouldUpdateRAM = Math.abs(ramUsage - prev.ramUsage) > 1;
      
      // Si rien n'a changé significativement, renvoyer l'état précédent
      if (!shouldUpdateStorage && !shouldUpdateCPU && !shouldUpdateRAM) {
        return prev;
      }
      
      // Sinon, mettre à jour avec les nouvelles valeurs
      return {
        ...prev,
        storageUsed: shouldUpdateStorage ? storageUsed : prev.storageUsed,
        storageLimit: shouldUpdateStorage ? storageTotal : prev.storageLimit,
        cpuUsage: shouldUpdateCPU ? cpuUsage : prev.cpuUsage,
        ramUsage: shouldUpdateRAM ? ramUsage : prev.ramUsage,
        lastUpdated: Date.now()
      };
    });
  };

  const handleAccessModeChange = (newMode) => {
    // Mettre à jour le localStorage
    localStorage.setItem('accessMode', newMode);
    
    // Mettre à jour l'état local
    setAccessMode(newMode);
    
    // Notifier le processus principal du changement
    window.electronAPI.updateAccessMode(newMode);
    
    // Afficher un message de confirmation
    setChangeStatus({
      show: true,
      success: true,
      message: `Mode d'accès changé pour: ${newMode === 'public' ? 'Public' : 'Privé'}`
    });
    
    // Masquer le message après 3 secondes
    setTimeout(() => {
      setChangeStatus({ show: false, success: false });
    }, 3000);
  };

  const handleSettingChange = async (setting, value) => {
    if (setting === 'downloadPath') {
      const newPath = await window.electronAPI.changeDownloadFolder();
      if (newPath) {
        setSettings(prev => ({
          ...prev,
          downloadPath: newPath
        }));
        setChangeStatus({ show: true, success: true });
        setTimeout(() => setChangeStatus({ show: false, success: false }), 3000);
      } else {
        setChangeStatus({ show: true, success: false });
        setTimeout(() => setChangeStatus({ show: false, success: false }), 3000);
      }
    } else {
      setSettings(prev => ({
        ...prev,
        [setting]: value
      }));
    }
  };

  // Fonction pour récupérer la liste des applications Docker
  const fetchApplications = async () => {
    setAppsLoading(true);
    setAppsError(null);
    
    try {
      // Configuration axios avec timeout plus long pour éviter les timeouts trop rapides
      const config = {
        timeout: 10000, // 10 secondes de timeout
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      };
      
      console.log(`Chargement des applications depuis: ${getServerUrl(accessMode)}/api/apps`);
      const response = await axios.get(`${getServerUrl(accessMode)}/api/apps`, config);
      
      // Vérifier la réponse
      if (!response.data || !Array.isArray(response.data)) {
        console.error('Format de réponse invalide:', response.data);
        throw new Error('Format de réponse invalide');
      }
      
      console.log(`${response.data.length} applications reçues`);
      
      const mappedApps = response.data.map(app => ({
        ...app,
        port: app.ports && app.ports.length > 0 ? app.ports[0] : null,
        autostart: false // Par défaut, on met à false, à améliorer avec une API de configuration
      }));
      
      setApplications(mappedApps);
      setAppsLoading(false);
      setAppsError(null); // Réinitialiser l'erreur en cas de succès
      return response.data; // Retourner les données pour chaînage de promesses
    } catch (error) {
      console.error('Erreur lors de la récupération des applications:', error);
      
      // Message d'erreur plus détaillé
      let errorMessage = 'Impossible de récupérer la liste des applications';
      
      if (error.response) {
        // Réponse du serveur avec un code d'erreur
        errorMessage += ` (${error.response.status}: ${error.response.statusText})`;
        console.error('Détails de la réponse:', error.response.data);
      } else if (error.request) {
        // Requête envoyée mais pas de réponse reçue
        errorMessage += ' (Aucune réponse du serveur)';
      } else {
        // Erreur lors de la création de la requête
        errorMessage += ` (${error.message})`;
      }
      
      setAppsError(errorMessage);
      setAppsLoading(false);
      throw error; // Propager l'erreur pour la gestion en amont
    }
  };

  // Fonction pour gérer les actions sur les applications (démarrer/arrêter)
  const handleAppAction = async (appId, action) => {
    try {
      // Mettre à jour l'interface utilisateur pour montrer que l'action est en cours
      setAppActionStatus({
        show: true,
        success: false,
        message: `Action ${action} en cours...`,
        appId
      });

      // Appeler l'API pour effectuer l'action
      const response = await axios.post(`${getServerUrl(accessMode)}/api/apps/${appId}/${action}`);
      
      // Attendre un court instant pour que les changements prennent effet sur le serveur
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mettre à jour la liste des applications après l'action
      await loadApplications(); // Utiliser loadApplications avec gestion d'erreur
      
      // Afficher un message de succès
      setAppActionStatus({
        show: true,
        success: true,
        message: response.data.message,
        appId
      });
      
      // Masquer le message après 3 secondes
      setTimeout(() => {
        setAppActionStatus({
          show: false,
          success: false,
          message: '',
          appId: null
        });
      }, 3000);
      
    } catch (error) {
      console.error(`Erreur lors de l'action ${action} sur l'application ${appId}:`, error);
      
      // Afficher un message d'erreur
      setAppActionStatus({
        show: true,
        success: false,
        message: error.response?.data?.message || `Erreur lors de l'action ${action}`,
        appId
      });
      
      // Masquer le message après 5 secondes
      setTimeout(() => {
        setAppActionStatus({
          show: false,
          success: false,
          message: '',
          appId: null
        });
      }, 5000);
    }
  };

  // Fonction pour gérer le démarrage automatique des applications
  const handleAppAutostart = async (appId, enabled) => {
    // Mettre à jour l'état local immédiatement pour une réponse UI rapide
    setApplications(prevApps => prevApps.map(app => 
      app.id === appId ? { ...app, autostart: enabled } : app
    ));
    
    try {
      // Cette partie serait à implémenter côté backend
      // Pour l'instant on simule juste la mise à jour
      console.log(`Application ${appId} autostart set to ${enabled}`);
      
      // Afficher un message de confirmation
      setAppActionStatus({
        show: true,
        success: true,
        message: `Démarrage automatique ${enabled ? 'activé' : 'désactivé'}`,
        appId
      });
      
      // Masquer le message après 3 secondes
      setTimeout(() => {
        setAppActionStatus({
          show: false,
          success: false,
          message: '',
          appId: null
        });
      }, 3000);
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du démarrage automatique pour ${appId}:`, error);
      
      // Annuler le changement local en cas d'erreur
      setApplications(prevApps => prevApps.map(app => 
        app.id === appId ? { ...app, autostart: !enabled } : app
      ));
      
      // Afficher un message d'erreur
      setAppActionStatus({
        show: true,
        success: false,
        message: "Erreur lors de la mise à jour du démarrage automatique",
        appId
      });
      
      // Masquer le message après 5 secondes
      setTimeout(() => {
        setAppActionStatus({
          show: false,
          success: false,
          message: '',
          appId: null
        });
      }, 5000);
    }
  };

  // Fonction pour sélectionner une application et afficher ses détails
  const handleAppSelect = (app) => {
    if (selectedApp && selectedApp.id === app.id) {
      // Si on clique sur l'app déjà sélectionnée, on ferme les détails
      setSelectedApp(null);
    } else {
      // Sinon, on affiche les détails de l'app
      setSelectedApp(app);
    }
  };

  // Fonction pour fermer la vue détaillée
  const closeAppDetails = () => {
    setSelectedApp(null);
  };

  const formatSize = (size) => {
    if (size < 1024) return size + ' GB';
    return (size / 1024).toFixed(1) + ' TB';
  };

  const formatPercentage = (used, total) => {
    return ((used / total) * 100).toFixed(1) + '%';
  };

  const handleShowDisks = async () => {
    const baseUrl = getServerUrl(accessMode);
    try {
      const response = await axios.get(`${baseUrl}/api/disks`);
      setSystemDisksInfo(response.data);
      setShowDisksInfo(!showDisksInfo);
    } catch (error) {
      console.error('Erreur lors de la récupération des informations des disques:', error);
    }
  };

  // Fonction pour charger les applications avec gestion d'erreur améliorée et tentatives de reconnexion
  const loadApplications = async (retryCount = 0) => {
    try {
      await fetchApplications();
      console.log('Applications chargées avec succès');
    } catch (error) {
      console.error(`Erreur lors du chargement des applications (tentative ${retryCount + 1})`, error);
      
      // Essayer de recharger une fois automatiquement après une première erreur
      if (retryCount < 1) {
        console.log('Tentative de rechargement automatique dans 2 secondes...');
        setTimeout(() => loadApplications(retryCount + 1), 2000);
      }
    }
  };

  // Effet pour charger les applications au montage du composant et quand accessMode change
  useEffect(() => {
    console.log('Chargement initial des applications...');
    
    // Délai court pour s'assurer que tout est initialisé avant de charger les applications
    const initTimer = setTimeout(() => {
      loadApplications();
    }, 500);
    
    // Connexion au websocket pour les mises à jour en temps réel
    const socket = io(getServerUrl(accessMode));
    
    socket.on('connect', () => {
      console.log('Socket connected');
      setSocketConnected(true);
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    });
    
    // Écouter les mises à jour des statuts d'applications
    socket.on('apps-status-update', (updatedApps) => {
      console.log('Received apps update:', updatedApps);
      setApplications(prevApps => {
        // Mettre à jour les applications tout en préservant les paramètres autostart
        return updatedApps.map(updatedApp => {
          const existingApp = prevApps.find(app => app.id === updatedApp.id);
          return {
            ...updatedApp,
            port: updatedApp.ports && updatedApp.ports.length > 0 ? updatedApp.ports[0] : null,
            autostart: existingApp ? existingApp.autostart : false
          };
        });
      });
    });
    
    return () => {
      socket.disconnect();
      clearTimeout(initTimer);
    };
  }, [accessMode]);

  if (loading) {
    return (
      <div className="settings-loading">
        <div className="loading-spinner"></div>
        <p>Chargement des paramètres...</p>
      </div>
    );
  }

  return (
    <div className="settings-container">
      {/* En-tête */}
      <div className="settings-header">
        <button className="back-btn" onClick={() => navigate('/home')}>
          ← Retour
        </button>
        <h1>Paramètres du Cloud</h1>
      </div>

      {/* Section Statistiques */}
      <section className="settings-section stats-section">
        <h2>
          Vue d'ensemble du système
          {serverInfoLoading && <span className="server-info-loading"> (Actualisation...)</span>}
        </h2>
        <div className="stats-grid">
          {/* Stockage */}
          <div className="stat-card storage" onClick={handleShowDisks} style={{ cursor: 'pointer' }}>
            <h3>Stockage {serverInfoLoading && <span className="info-refreshing-indicator"></span>}</h3>
            <div className="progress-container">
              <div 
                className={`progress-bar ${serverInfoLoading ? 'loading-transition' : ''}`}
                style={{ width: formatPercentage(stats.storageUsed, stats.storageLimit) }}
              ></div>
            </div>
            <div className="stat-details">
              <span>{formatSize(stats.storageUsed)} utilisés</span>
              <span>sur {formatSize(stats.storageLimit)}</span>
            </div>
          </div>

          {/* Performance */}
          <div className="stat-card performance">
            <h3>Performance</h3>
            <div className="performance-stats">
              <div className="performance-item">
                <span>CPU</span>
                <div className="progress-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: stats.cpuUsage + '%' }}
                  ></div>
                </div>
                <span>{stats.cpuUsage}%</span>
              </div>
              <div className="performance-item">
                <span>RAM</span>
                <div className="progress-container">
                  <div 
                    className="progress-bar" 
                    style={{ width: stats.ramUsage + '%' }}
                  ></div>
                </div>
                <span>{stats.ramUsage}%</span>
              </div>
            </div>
          </div>

          {/* Statistiques générales */}
          <div className="stat-card general">
            <h3>Statistiques</h3>
            <div className="general-stats">
              <div className="stat-item">
                <span>Utilisateurs actifs</span>
                <strong>{stats.activeUsers}</strong>
              </div>
              <div className="stat-item">
                <span>Fichiers totaux</span>
                <strong>{stats.totalFiles}</strong>
              </div>
            </div>
          </div>

          {/* Statut de la sauvegarde */}
          <div className="stat-card backup">
            <h3>Sauvegarde</h3>
            <div className="backup-info">
              <div className="backup-status">
                <span className={`status-indicator ${stats.backupStatus.toLowerCase()}`}></span>
                <span>{stats.backupStatus}</span>
              </div>
              <div className="last-backup">
                Dernière sauvegarde: {stats.lastBackup}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal Détails Disques */}
      {showDisksInfo && systemDisksInfo && (
        <div className="disks-modal-overlay">
          <div className="disks-modal">
            <div className="disks-modal-header">
              <h3>Détails des disques</h3>
              <button className="close-modal-btn" onClick={() => setShowDisksInfo(false)}>×</button>
            </div>
            <div className="disks-modal-content">
              <div className="disks-grid">
                {systemDisksInfo.disks.map((disk, idx) => {
                  // Calcul du pourcentage d'utilisation
                  const usedSizeGB = parseFloat(disk.used.replace(' GB', ''));
                  const totalSizeGB = parseFloat(disk.size.replace(' GB', ''));
                  const usedPercentage = Math.round((usedSizeGB / totalSizeGB) * 100) || 0;
                  
                  return (
                    <div key={idx} className={`disk-card ${disk.mounted ? 'mounted' : 'unmounted'}`}>
                      <div className="disk-header">
                        <div className="disk-name-with-status">
                          <FontAwesomeIcon icon={faHdd} className={`disk-icon-visual ${disk.mounted ? 'mounted' : 'unmounted'}`} />
                          <div className="disk-title-area">
                            <h4>{disk.device}</h4>
                            <div className={`disk-status-badge ${disk.mounted ? 'mounted' : 'unmounted'}`}>
                              <span className="status-dot"></span>
                              {disk.mounted ? 'Monté' : 'Démonté'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="disk-details">
                        <div className="disk-info-rows">
                          <div className="disk-info-row">
                            <span>Capacité:</span>
                            <strong>{disk.size}</strong>
                          </div>
                          <div className="disk-info-row">
                            <span>Utilisé:</span>
                            <strong>{disk.used}</strong>
                          </div>
                          <div className="disk-info-row">
                            <span>Libre:</span>
                            <strong>{disk.free}</strong>
                          </div>
                        </div>
                        
                        {disk.mounted ? (
                          <div className="disk-usage-bar-container">
                            <div className="disk-usage-label">
                              <span>Utilisation:</span>
                              <strong>{usedPercentage}%</strong>
                            </div>
                            <div className="disk-usage-bar">
                              <div 
                                className="disk-usage-fill" 
                                style={{ width: `${usedPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <button 
                            className="mount-disk-button"
                            onClick={() => console.log(`Monter le disque ${disk.device}`)}
                          >
                            <FontAwesomeIcon icon={faPlug} /> Monter le disque
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="disk-total-card">
                <div className="disk-total-header">
                  <FontAwesomeIcon icon={faDatabase} className="disk-total-icon" />
                  <h3>Stockage Total</h3>
                </div>
                
                <div className="disk-total-content">
                  <div className="disk-info-rows">
                    <div className="disk-info-row">
                      <span>Capacité:</span>
                      <strong>{systemDisksInfo.total.size}</strong>
                    </div>
                    <div className="disk-info-row">
                      <span>Utilisé:</span>
                      <strong>{systemDisksInfo.total.used}</strong>
                    </div>
                    <div className="disk-info-row">
                      <span>Libre:</span>
                      <strong>{systemDisksInfo.total.free}</strong>
                    </div>
                  </div>
                  
                  {/* Calcul du pourcentage d'utilisation pour le total */}
                  {(() => {
                    const totalUsedGB = parseFloat(systemDisksInfo.total.used.replace(' GB', ''));
                    const totalSizeGB = parseFloat(systemDisksInfo.total.size.replace(' GB', ''));
                    const totalUsedPercentage = Math.round((totalUsedGB / totalSizeGB) * 100) || 0;
                    
                    return (
                      <div className="disk-usage-bar-container total">
                        <div className="disk-usage-label">
                          <span>Utilisation globale:</span>
                          <strong>{totalUsedPercentage}%</strong>
                        </div>
                        <div className="disk-usage-bar">
                          <div 
                            className="disk-usage-fill" 
                            style={{ width: `${totalUsedPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Section Téléchargements */}
      <section className="settings-section">
        <h2>Configuration des téléchargements</h2>
        <div className="settings-grid">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Dossier de téléchargement</h3>
              <p>Emplacement où seront sauvegardés les fichiers téléchargés</p>
              {changeStatus.show && (
                <div className={`status-message ${changeStatus.success ? 'success' : 'error'}`}>
                  {changeStatus.success 
                    ? "✓ Dossier modifié avec succès" 
                    : "✗ Erreur lors du changement de dossier"}
                </div>
              )}
            </div>
            <div className="setting-control">
              <button 
                onClick={() => handleSettingChange('downloadPath')} 
                className="setting-button"
              >
                <span className="setting-value">{settings.downloadPath}</span>
                <span className="setting-action">Modifier</span>
              </button>
            </div>
          </div>
        </div>
      </section>
          {/* Section Applications */}
          <section className="settings-section">
        <h2>Gestion des Applications</h2>
        
        {/* Modal pour afficher les détails d'une application */}
        {selectedApp && (
          <div className="docker-app-details-modal">
            <div className="docker-app-details-content">
              <div className="docker-app-details-header">
                <h3>{selectedApp.name}</h3>
                <button className="docker-close-btn" onClick={closeAppDetails}>×</button>
              </div>
              <div className="docker-app-details-body">
                <div className="docker-app-status-info">
                  <div className={`docker-app-status ${selectedApp.status}`}>
                    <span className="docker-status-icon"></span>
                    <span className="docker-status-text">
                      {selectedApp.status === 'running' ? 'Opérationnel' : 'Arrêté'}
                    </span>
                  </div>
                  <div className="docker-app-progress">
                    <div className="docker-progress-bar">
                      <div 
                        className="docker-progress-fill" 
                        style={{ width: `${selectedApp.progress}%` }}
                      ></div>
                    </div>
                    <span className="docker-progress-text">{selectedApp.progress}% ({selectedApp.containersRunning})</span>
                  </div>
                </div>
                
                <div className="docker-app-info-section">
                  <h4>Ports</h4>
                  {selectedApp.ports && selectedApp.ports.length > 0 ? (
                    <div className="docker-ports-list">
                      {selectedApp.ports.map(port => (
                        <div key={port} className="docker-port-tag">
                          {port}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Aucun port exposé</p>
                  )}
                </div>
                
                <div className="docker-app-info-section">
                  <h4>Conteneurs</h4>
                  <div className="docker-containers-list">
                    {selectedApp.containers && selectedApp.containers.map(container => (
                      <div key={container.id} className="docker-container-item">
                        <div className="docker-container-name">{container.name}</div>
                        <div className={`docker-container-status ${container.state}`}>
                          {container.state}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="docker-app-actions">
                  <button
                    className={`docker-action-btn-large ${selectedApp.status === 'running' ? 'stop' : 'start'}`}
                    onClick={() => handleAppAction(selectedApp.id, selectedApp.status === 'running' ? 'stop' : 'start')}
                  >
                    {selectedApp.status === 'running' ? 'Arrêter tous les conteneurs' : 'Démarrer tous les conteneurs'}
                  </button>
                  <button
                    className="docker-action-btn-large restart"
                    onClick={() => handleAppAction(selectedApp.id, 'restart')}
                    disabled={selectedApp.status !== 'running'}
                  >
                    Redémarrer tous les conteneurs
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {appsLoading ? (
          <div className="docker-loading-container">
            <div className="docker-loading-spinner"></div>
            <p>Chargement des applications...</p>
          </div>
        ) : appsError ? (
          <div className="docker-error-container">
            <p className="docker-error-message">{appsError}</p>
            <button className="docker-retry-button" onClick={() => {
              console.log('Tentative manuelle de rechargement des applications...');
              loadApplications();
            }}>Réessayer</button>
          </div>
        ) : applications.length === 0 ? (
          <div className="docker-empty-state">
            <p>Aucune application Docker détectée.</p>
          </div>
        ) : (
          <div className="docker-apps-grid">
            {applications.map(app => (
              <div 
                key={app.id} 
                className={`docker-app-card ${selectedApp && selectedApp.id === app.id ? 'active' : ''}`}
                onClick={() => handleAppSelect(app)}
              >
                <div className="docker-app-header">
                  <h3>{app.name}</h3>
                  <span className={`docker-status-badge ${app.status}`}>
                    {app.status === 'running' ? 'En cours' : 'Arrêté'}
                  </span>
                </div>
                
                {appActionStatus.show && appActionStatus.appId === app.id && (
                  <div className={`docker-action-status ${appActionStatus.success ? 'success' : 'error'}`}>
                    {appActionStatus.message}
                  </div>
                )}
                
                <div className="docker-app-controls">
                  <button
                    className={`docker-action-btn ${app.status === 'running' ? 'stop' : 'start'}`}
                    onClick={(e) => {
                      e.stopPropagation(); // Empêcher le déclenchement du onClick du parent
                      handleAppAction(app.id, app.status === 'running' ? 'stop' : 'start')
                    }}
                  >
                    {app.status === 'running' ? 'Arrêter' : 'Démarrer'}
                  </button>
                  <button
                    className="docker-action-btn restart"
                    onClick={(e) => {
                      e.stopPropagation(); // Empêcher le déclenchement du onClick du parent
                      handleAppAction(app.id, 'restart')
                    }}
                    disabled={app.status !== 'running'}
                  >
                    Redémarrer
                  </button>
                  <div className="docker-autostart-control" onClick={(e) => e.stopPropagation()}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={app.autostart}
                        onChange={(e) => handleAppAutostart(app.id, e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                    <span className="docker-autostart-label">Auto</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {/* Section Paramètres */}
      <section className="settings-section">
        <h2>Configuration du Cloud</h2>
        <div className="settings-grid">
          {/* Sauvegardes */}
          <div className="settings-card">
            <h3>Sauvegardes</h3>
            <div className="setting-item">
              <label>Sauvegarde automatique</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoBackup}
                  onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-item">
              <label>Fréquence des sauvegardes</label>
              <select
                value={settings.backupFrequency}
                onChange={(e) => handleSettingChange('backupFrequency', e.target.value)}
                disabled={!settings.autoBackup}
              >
                <option value="hourly">Toutes les heures</option>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
              </select>
            </div>
          </div>

          {/* Sécurité */}
          <div className="settings-card">
            <h3>Sécurité</h3>
            <div className="setting-item">
              <label>Chiffrement des données</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.encryptionEnabled}
                  onChange={(e) => handleSettingChange('encryptionEnabled', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-item">
              <label>Authentification à deux facteurs</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.twoFactorAuth}
                  onChange={(e) => handleSettingChange('twoFactorAuth', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          {/* Notifications */}
          <div className="settings-card">
            <h3>Notifications</h3>
            <div className="setting-item">
              <label>Activer les notifications</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.notificationsEnabled}
                  onChange={(e) => handleSettingChange('notificationsEnabled', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          {/* Préférences */}
          <div className="settings-card">
            <h3>Préférences</h3>
            <div className="setting-item">
              <label>Mode sombre</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          {/* Performance */}
          <div className="settings-card">
            <h3>Performance</h3>
            <div className="setting-item">
              <label>Niveau de compression</label>
              <select
                value={settings.compressionLevel}
                onChange={(e) => handleSettingChange('compressionLevel', e.target.value)}
              >
                <option value="none">Aucune compression</option>
                <option value="low">Faible</option>
                <option value="medium">Moyenne</option>
                <option value="high">Élevée</option>
              </select>
            </div>
            <div className="setting-item">
              <label>Limite de bande passante</label>
              <select
                value={settings.bandwidthLimit}
                onChange={(e) => handleSettingChange('bandwidthLimit', e.target.value)}
              >
                <option value="unlimited">Illimitée</option>
                <option value="1000">1 Gbps</option>
                <option value="500">500 Mbps</option>
                <option value="100">100 Mbps</option>
              </select>
            </div>
          </div>

          {/* Nettoyage automatique */}
          <div className="settings-card">
            <h3>Nettoyage automatique</h3>
            <div className="setting-item">
              <label>Suppression automatique des fichiers anciens</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoDelete}
                  onChange={(e) => handleSettingChange('autoDelete', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            <div className="setting-item">
              <label>Période de conservation (jours)</label>
              <select
                value={settings.autoDeletionPeriod}
                onChange={(e) => handleSettingChange('autoDeletionPeriod', e.target.value)}
                disabled={!settings.autoDelete}
              >
                <option value="7">7 jours</option>
                <option value="30">30 jours</option>
                <option value="90">90 jours</option>
                <option value="180">180 jours</option>
                <option value="365">365 jours</option>
              </select>
            </div>
          </div>

          {/* Mode d'accès */}
          <div className="setting-item">
            <div className="setting-info">
              <h3>Mode d'accès</h3>
              <p>Définit comment l'application se connecte au serveur Ryvie</p>
              {changeStatus.show && (
                <div className={`status-message ${changeStatus.success ? 'success' : 'error'}`}>
                  {changeStatus.success 
                    ? changeStatus.message || "✓ Paramètre modifié avec succès" 
                    : "✗ Erreur lors du changement de paramètre"}
                </div>
              )}
            </div>
            <div className="setting-control">
              <div className="toggle-buttons">
                <button 
                  className={`toggle-button ${accessMode === 'private' ? 'active' : ''}`}
                  onClick={() => handleAccessModeChange('private')}
                >
                  Privé (Local)
                </button>
                <button 
                  className={`toggle-button ${accessMode === 'public' ? 'active' : ''}`}
                  onClick={() => handleAccessModeChange('public')}
                >
                  Public (Internet)
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Stockage */}
      <section className="settings-section">
        <h2>Configuration du Stockage</h2>
        <div className="storage-options">
          {/* Emplacement du stockage */}
          <div className="settings-card">
            <h3>Emplacement des données</h3>
            <div className="setting-item">
              <label>Stockage principal</label>
              <select
                value={settings.storageLocation}
                onChange={(e) => handleSettingChange('storageLocation', e.target.value)}
              >
                <option value="local">Serveur local</option>
                <option value="cloud">Cloud Ryvie</option>
                <option value="hybrid">Hybride (Local + Cloud)</option>
              </select>
            </div>
            {settings.storageLocation !== 'local' && (
              <div className="ryvie-servers">
                <h4>Serveurs Ryvie disponibles</h4>
                {ryvieServers.map(server => (
                  <div key={server.id} className="server-item">
                    <div className="server-info">
                      <span className="server-name">{server.name}</span>
                      <span className="server-location">{server.location}</span>
                    </div>
                    <div className="server-status-settings">
                      <span className="ping">{server.ping}</span>
                      <span className={`status-dot ${server.status}`}></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gestion des disques */}
          <div className="settings-card">
            <h3>Gestion des Disques</h3>
            <div className="setting-item">
              <label>Configuration RAID</label>
              <select
                value={settings.redundancyLevel}
                onChange={(e) => handleSettingChange('redundancyLevel', e.target.value)}
              >
                <option value="none">Pas de RAID</option>
                <option value="raid0">RAID 0 (Performance)</option>
                <option value="raid1">RAID 1 (Miroir)</option>
                <option value="raid5">RAID 5 (Sécurité)</option>
                <option value="raid10">RAID 10 (Performance + Sécurité)</option>
              </select>
            </div>
            <div className="disks-grid">
              {disks.map(disk => (
                <div key={disk.id} className="disk-card">
                  <div className="disk-header">
                    <div className="disk-name-with-status">
                      <FontAwesomeIcon icon={faHdd} className={`disk-icon-visual ${disk.status}`}/>
                      <div className="disk-title-area">
                        <h4>{disk.name}</h4>
                        <div className={`disk-status-badge ${disk.status}`}>
                          <span className="status-dot"></span>
                          {disk.status}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="disk-details">
                    <div className="disk-info-rows">
                      <div className="disk-info-row">
                        <span>Capacité:</span>
                        <strong>{disk.size}</strong>
                      </div>
                      <div className="disk-info-row">
                        <span>Utilisé:</span>
                        <strong>{disk.used}</strong>
                      </div>
                      <div className="disk-info-row">
                        <span>Libre:</span>
                        <strong>{disk.free}</strong>
                      </div>
                    </div>
                    
                    <div className="disk-usage-bar-container">
                      <div className="disk-usage-label">
                        <span>Utilisation:</span>
                        <strong>{((parseFloat(disk.used.replace(' GB', '')) / parseFloat(disk.size.replace(' GB', ''))) * 100).toFixed(1)}%</strong>
                      </div>
                      <div className="disk-usage-bar">
                        <div 
                          className="disk-usage-fill" 
                          style={{ width: `${((parseFloat(disk.used.replace(' GB', '')) / parseFloat(disk.size.replace(' GB', ''))) * 100).toFixed(1)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Settings;
