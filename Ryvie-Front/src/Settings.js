import React from 'react';
import './Settings.css';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
  const navigate = useNavigate();

  return (
    <div className="settings">
      <h1>Hello world</h1>
      {/* Bouton pour retourner à la page d'accueil */}
      <button onClick={() => navigate('/home')}>Retour à l'accueil</button>
    </div>
  );
}

export default Settings;
