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
    const removeListener = window.electronAPI?.onRyvieIP((ip) => {
      console.log(`IP reçue dans React : ${ip}`);
      setServerIP(ip);
      setLoading(false);
    });

    const timeout = setTimeout(() => setLoading(false), 10000);

    return () => {
      if (removeListener) removeListener();
      clearTimeout(timeout);
    };
  }, []);

  const handleUnlock = () => {
    setUnlocked(true);
    setTimeout(() => {
      navigate('/home');
    }, 500);
  };

  return (
    <div className="welcome-body">
      <div className="welcome-overlay">
        {/* Texte indépendant dans le rectangle */}
        <div className="welcome-text-container">
          <h1>Bonjour Jules !</h1>
        </div>
        {/* Conteneur dynamique pour le contenu */}
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
        {/* Boutons intégrés dans le rectangle */}
        <div className="welcome-buttons-container">
          <div className="welcome-button-wrapper">
            <button
              className="welcome-button"
              onClick={handleUnlock}
              disabled={!serverIP}
              aria-label={serverIP ? 'Déverrouiller l\'accès' : 'En attente de connexion...'}
            >
              {serverIP ? 'Déverrouiller' : 'En attente de connexion...'}
            </button>
          </div>
          <div className="welcome-button-wrapper">
            <button
              className="welcome-button alt-button"
              onClick={() => navigate('/home')}
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
