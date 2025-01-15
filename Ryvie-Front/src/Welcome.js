import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/Welcome.css';
import serverIcon from './icons/lettre-r.png';

const Welcome = () => {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [serverIP, setServerIP] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Recherche d\'un serveur Ryvie...');

    // Fonction de rappel pour traiter les IP reçues
    const handleServerIP = (_, data) => {
      console.log(`IP reçue dans React : ${data.ip}`);
      setServerIP(data.ip);
      setLoading(false);
    };

    // Vérifier si l'API Electron est disponible
    if (window.electronAPI && window.electronAPI.onRyvieIP) {
      // Ajouter le gestionnaire d'événements pour 'ryvie-ip'
      window.electronAPI.onRyvieIP(handleServerIP);

      // Nettoyage de l'effet
      return () => {
        window.electronAPI.onRyvieIP(handleServerIP); // Nettoie l'écouteur
      };
    } else {
      // Si l'API n'est pas disponible, simuler un serveur trouvé pour le développement web
      console.log('Mode développement web - API Electron non disponible');
      setServerIP('ryvie.local');
      setLoading(false);
    }

    // Timeout pour arrêter la recherche après 10 secondes
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    return () => {
      clearTimeout(timeout); // Nettoie le timeout
    };
  }, []);

  const handlePrivateAccess = () => {
    localStorage.setItem('accessMode', 'private');
    setUnlocked(true);
    setTimeout(() => {
      navigate('/home');
    }, 10);
  };
  
  const handlePublicAccess = () => {
    localStorage.setItem('accessMode', 'public');
    setUnlocked(true);
    setTimeout(() => {
      navigate('/home');
    }, 10);
  };
  
  return (
    <div className="welcome-body">
      <div className="welcome-overlay">
        <div className="welcome-text-container">
          <h1>Bonjour Jules !</h1>
        </div>
        <div className={`welcome-container ${unlocked ? 'welcome-hidden' : ''}`}>
          {loading && !serverIP ? (
            <>
              <div className="welcome-loading-container">
                <div className="welcome-loading"></div>
              </div>
              <div className="welcome-research-server">
                <p aria-live="polite">Recherche d'un serveur Ryvie en cours...</p>
              </div>
            </>
          ) : serverIP ? (
            <div className="welcome-server-found">
              <img src={serverIcon} alt="Icône de serveur Ryvie" className="welcome-server-icon" />
              <div className="welcome-server-info">
                <p className="welcome-server-text">Connexion Ryvie établie</p>
                <p className="welcome-server-ip">{serverIP}</p>
              </div>
            </div>
          ) : (
            <div className="welcome-research-server">
              <p>Aucun serveur détecté pour le moment.</p>
            </div>
          )}
        </div>
        <div className="welcome-buttons-container">
          <button
            className="welcome-button"
            onClick={handlePrivateAccess}
            disabled={!serverIP}
            aria-label={serverIP ? 'Accès depuis la maison' : 'En attente de connexion...'}
          >
            <svg className="button-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="button-content">
              <span>Réseau Local</span>
              <span className="button-subtitle">Accès depuis la maison</span>
            </div>
          </button>
          <button
            className="welcome-button"
            onClick={handlePublicAccess}
            aria-label="Accès distant"
          >
            <svg className="button-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.6 9H20.4M3.6 15H20.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 3C14.5013 3 16.5313 7.02944 16.5313 12C16.5313 16.9706 14.5013 21 12 21C9.49874 21 7.46875 16.9706 7.46875 12C7.46875 7.02944 9.49874 3 12 3Z" 
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="button-content">
              <span>Réseau Externe</span>
              <span className="button-subtitle">Accès depuis l'extérieur</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
  
} 
export default Welcome;