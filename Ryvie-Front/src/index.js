import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import Home from './Home';
import User from './User';
import Settings from './Settings';

const Welcome = () => {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [serverIP, setServerIP] = useState(null);

  useEffect(() => {
    console.log('Recherche d\'un serveur Ryvie...');
    const removeListener = window.electronAPI?.onRyvieIP((ip) => {
      console.log(`IP reçue dans React : ${ip}`);
      setServerIP(ip);
    });

    // Nettoyage pour éviter les fuites mémoire
    return () => {
      if (removeListener) {
        removeListener(); // Appeler la fonction retournée par onRyvieIP
      }
    };
  }, []);

  const handleUnlock = () => {
    setUnlocked(true);
    navigate('/home');
  };

  return (
    <div>
      <h1>Hello Jules</h1>
      <p>Bienvenue sur l'application !</p>
      {serverIP ? (
        <p>Serveur Ryvie détecté à l'adresse : {serverIP}</p>
      ) : (
        <p>Recherche d'un serveur Ryvie...</p>
      )}
      <div>
        <button onClick={handleUnlock} disabled={!serverIP}>
          {serverIP ? 'Déverrouiller' : 'En attente de connexion...'}
        </button>
        <button onClick={() => {navigate('/home')}}>Déverrouiller depuis l'extérieur de chez moi</button>

      </div>
    </div>
  );
};

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/home" element={<Home />} />
      <Route path="/user" element={<User />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  </Router>
);

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
