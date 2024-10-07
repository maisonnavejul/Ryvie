import React, { useState } from 'react';  // Utiliser le hook useState pour gérer l'état du bouton
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';  // Utiliser useNavigate pour la redirection
import Home from './Home';  // Importer la page d'accueil

// Composant d'accueil avec le bouton de déverrouillage
const Welcome = () => {
  const navigate = useNavigate();  // Utiliser le hook useNavigate pour la redirection
  const [unlocked, setUnlocked] = useState(false);  // État pour savoir si le bouton est cliqué

  const handleUnlock = () => {
    setUnlocked(true);  // Mettre à jour l'état
    navigate('/home');  // Rediriger vers la page Home après avoir cliqué sur le bouton
  };

  return (
    <div>
      <h1>Hello Jules</h1>
      <p>Bienvenue sur l'application !</p>
      <button onClick={handleUnlock}>Déverrouiller</button>  {/* Bouton pour déverrouiller */}
    </div>
  );
};

// Configurer les routes avec React Router
const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Welcome />} />  {/* Route par défaut avec le message Hello Jules */}
      <Route path="/home" element={<Home />} />  {/* Route pour la page d'accueil */}
    </Routes>
  </Router>
);

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
