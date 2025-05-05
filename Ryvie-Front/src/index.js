import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Home from './Home';
import User from './User';
import Settings from './Settings';
import Welcome from './welcome'; // Import du composant Welcome
import Userlogin from './connexion'; // Ancien composant Login
import Login from './Login'; // Nouveau composant Login
import { initializeToken, isAuthenticated } from './services/authService';
import AuthListener from './components/AuthListener'; // Import du composant d'écoute d'authentification

// Initialiser le token au démarrage de l'application
initializeToken();

// Composant de redirection conditionnelle
const ProtectedRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/login" />;
};

const App = () => (
  <Router>
    {/* Composant qui écoute les événements d'authentification depuis Electron */}
    <AuthListener />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Welcome />
        </ProtectedRoute>
      } />
      <Route path="/home" element={
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      } />
      <Route path="/user" element={<User />} />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/userlogin" element={<Userlogin />} />
    </Routes>
  </Router>
);

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
