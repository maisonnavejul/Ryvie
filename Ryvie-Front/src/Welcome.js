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

    // Ajouter le gestionnaire d'événements pour 'ryvie-ip'
    window.electronAPI.onRyvieIP(handleServerIP);

    // Timeout pour arrêter la recherche après 10 secondes
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    // Nettoyage de l'effet
    return () => {
      window.electronAPI.onRyvieIP(handleServerIP); // Nettoie l'écouteur
      clearTimeout(timeout); // Nettoie le timeout
    };
  }, []);

  const handlePrivateAccess = () => {
    localStorage.setItem('accessMode', 'private'); // Stocke l'état comme privé
    setUnlocked(true);
    setTimeout(() => {
      navigate('/home');
    }, 500);
  };
  
  const handlePublicAccess = () => {
    localStorage.setItem('accessMode', 'public'); // Stocke l'état comme public
    setUnlocked(true);
    setTimeout(() => {
      navigate('/home');
    }, 500);
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
                <p className="welcome-server-text">Votre serveur Ryvie a été trouvé</p>
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
          <div className="welcome-button-wrapper">
            <button
              className="welcome-button"
              onClick={handlePrivateAccess}
              disabled={!serverIP}
              aria-label={serverIP ? 'Déverrouiller l\'accès' : 'En attente de connexion...'}
            >
              Accéder à mon cloud depuis chez moi
            </button>
          </div>
          <div className="welcome-button-wrapper">
            <button
              className="welcome-button alt-button"
              onClick={handlePublicAccess}
              aria-label="Accéder au cloud depuis l'extérieur"
            >
              Accéder à mon cloud depuis l'extérieur
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  
} 
export default Welcome;