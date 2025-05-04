import React, { useState, useEffect } from 'react';
import './styles/Settings.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faServer, faHdd, faDatabase, faPlug } from '@fortawesome/free-solid-svg-icons';
const { getServerUrl } = require('./config/urls');

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    storageUsed: 0,
    storageLimit: 0, // Go
    cpuUsage: 0,
    ramUsage: 0,
    activeUsers: 1,
    totalFiles: 110,
    backupStatus: 'Completed',
    lastBackup: '2024-01-09 14:30',
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
    storageLocation: 'local',
    redundancyLevel: 'raid1',
    downloadPath: '',
  });

  const [applications, setApplications] = useState([
    {
      id: 1,
      name: 'Serveur Web',
      status: 'running',
      port: 80,
      autostart: true,
    },
    {
      id: 2,
      name: 'Base de données',
      status: 'running',
      port: 3306,
      autostart: true,
    },
    {
      id: 3,
      name: 'Serveur FTP',
      status: 'stopped',
      port: 21,
      autostart: false,
    },
  ]);

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

  // Récupération des informations serveur
  useEffect(() => {
    // Récupère la valeur de accessMode depuis le localStorage
    const storedMode = localStorage.getItem('accessMode') || 'private';
    setAccessMode(storedMode);
    
    // Détermine l'URL du serveur en fonction du mode d'accès
    const baseUrl = getServerUrl(storedMode);
    console.log("Connexion à :", baseUrl);
    
    // Fonction pour récupérer les informations serveur
    const fetchServerInfo = async () => {
      try {
        const response = await axios.get(`${baseUrl}/api/server-info`);
        console.log('Informations serveur reçues:', response.data);
        updateServerStats(response.data);
      } catch (error) {
        console.error('Erreur lors de la récupération des informations serveur:', error);
      }
    };
    
    // Appel initial
    fetchServerInfo();
    
    // Configuration de l'intervalle pour les mises à jour régulières
    const intervalId = setInterval(fetchServerInfo, 2000);
    
    // Nettoyage lors du démontage du composant
    return () => {
      clearInterval(intervalId);
    };
  }, [accessMode]); // Réexécute l'effet si le mode d'accès change
  
  // Fonction pour mettre à jour les statistiques du serveur
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
    
    // Mettre à jour les statistiques
    setStats(prev => ({
      ...prev,
      storageUsed: storageUsed,
      storageLimit: storageTotal,
      cpuUsage: cpuUsage,
      ramUsage: ramUsage
    }));
  };

  // Fonction pour changer le mode d'accès
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

  const handleAppAction = (appId, action) => {
    setApplications(prev => prev.map(app => {
      if (app.id === appId) {
        return {
          ...app,
          status: action === 'start' ? 'running' : 'stopped'
        };
      }
      return app;
    }));
  };

  const handleAppAutostart = (appId, autostart) => {
    setApplications(prev => prev.map(app => {
      if (app.id === appId) {
        return {
          ...app,
          autostart
        };
      }
      return app;
    }));
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
        <h2>Vue d'ensemble du système</h2>
        <div className="stats-grid">
          {/* Stockage */}
          <div className="stat-card storage" onClick={handleShowDisks} style={{ cursor: 'pointer' }}>
            <h3>Stockage</h3>
            <div className="progress-container">
              <div 
                className="progress-bar" 
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

      {/* Section Applications */}
      <section className="settings-section">
        <h2>Gestion des Applications</h2>
        <div className="apps-grid">
          {applications.map(app => (
            <div key={app.id} className="app-card">
              <div className="app-header">
                <h3>{app.name}</h3>
                <span className={`status-badge ${app.status}`}>
                  {app.status === 'running' ? 'En cours' : 'Arrêté'}
                </span>
              </div>
              <div className="app-details">
                <p>Port: {app.port}</p>
                <div className="app-controls">
                  <button
                    className={`action-btn ${app.status === 'running' ? 'stop' : 'start'}`}
                    onClick={() => handleAppAction(app.id, app.status === 'running' ? 'stop' : 'start')}
                  >
                    {app.status === 'running' ? 'Arrêter' : 'Démarrer'}
                  </button>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={app.autostart}
                      onChange={(e) => handleAppAutostart(app.id, e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                  <span className="autostart-label">Démarrage auto</span>
                </div>
              </div>
            </div>
          ))}
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
