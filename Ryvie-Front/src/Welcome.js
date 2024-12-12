import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Welcome.css';
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
      <div className={`welcome-container ${unlocked ? 'welcome-hidden' : ''}`}>
        <h1>Hello Jules</h1>
        <p>Bienvenue sur l'application Ryvie !</p>
        {loading && !serverIP ? (
          <>
            <div className="welcome-loading"></div>
            <p>Recherche d'un serveur Ryvie en cours...</p>
          </>
        ) : serverIP ? (
          <div className="welcome-server-found">
            <img src={serverIcon} alt="Server Icon" className="welcome-server-icon" />
            <div className="welcome-server-info">
              <p className="welcome-server-text">Votre serveur Ryvie a été trouvé</p>
              <p className="welcome-server-ip">{serverIP}</p>
            </div>
          </div>
        ) : (
          <p>Aucun serveur détecté pour le moment.</p>
        )}
        <div>
          <button
            className="welcome-button"
            onClick={handleUnlock}
            disabled={!serverIP}
          >
            {serverIP ? 'Déverrouiller' : 'En attente de connexion...'}
          </button>
          <button
            className="welcome-button"
            onClick={() => navigate('/home')}
            style={{ marginLeft: '10px' }}
          >
            Accéder à mon cloud depuis l'extérieur
          </button>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
