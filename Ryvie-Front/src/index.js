import React from 'react';
import ReactDOM from 'react-dom/client'; // Assure-toi d'importer depuis 'react-dom/client'

// Crée ton composant principal
const App = () => (
  <div>
    <h1>Bienvenue dans mon app Electron avec React 18</h1>
    <p>Ceci est une interface construite avec la nouvelle API de React 18.tests</p>
  </div>
);

// Sélectionner l'élément DOM où l'application React sera rendue
const rootElement = document.getElementById('root');

// Utiliser createRoot au lieu de ReactDOM.render
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
