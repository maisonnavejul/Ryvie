import React, { useState, useEffect } from 'react';  // Utiliser le hook useState pour gérer l'état du bouton
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';  // Utiliser useNavigate pour la redirection
import Home from './Home';  // Importer la page d'accueil
import User from './User';
import Settings from './Settings';

// Composant d'accueil avec le bouton de déverrouillage
const Welcome = () => {
  const navigate = useNavigate();  // Utiliser le hook useNavigate pour la redirection
  const [unlocked, setUnlocked] = useState(false);  // État pour savoir si le bouton est cliqué
  const [serverIP, setServerIP] = useState(null);
  
  useEffect(() => {
    if (window.electronAPI) {
      console.log('API Electron disponible');
      window.electronAPI.onRyvieIP((ip) => {
        console.log(`IP reçue dans React : ${ip}`);
        setServerIP(ip);
      });
    } else {
      console.error("API Electron non disponible");
    }
  }, []);
  
  const handleUnlock = () => {
    setUnlocked(true);  // Mettre à jour l'état
    navigate('/home');  // Rediriger vers la page Home après avoir cliqué sur le bouton
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
      <button onClick={handleUnlock} disabled={!serverIP}>
        {serverIP ? 'Déverrouiller' : 'En attente de connexion...'}
      </button>
    </div>
  );
};

// Configurer les routes avec React Router
const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Welcome />} />  {/* Route par défaut avec le message Hello Jules */}
      <Route path="/home" element={<Home />} />  {/* Route pour la page d'accueil */}
      <Route path="/user" element={<User />} />  {/* Route pour la page de gestion des utilisateurs */}
      <Route path="/settings" element={<Settings />} />  {/* Route pour la page des paramètres */}

    </Routes>
  </Router>
);

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
