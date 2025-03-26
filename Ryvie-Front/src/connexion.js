import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './styles/connexion.css';
const { getServerUrl } = require('./config/urls');

const UserLogin = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // 'info', 'success', 'error'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessMode, setAccessMode] = useState('private');
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const currentUser = localStorage.getItem('currentUser');
  const currentUserRole = localStorage.getItem('currentUserRole');

  useEffect(() => {
    // Récupérer le mode d'accès depuis le localStorage
    const storedMode = localStorage.getItem('accessMode') || 'private';
    setAccessMode(storedMode);
    
    const fetchUsers = async () => {
      try {
        // Utiliser l'URL du serveur en fonction du mode d'accès
        const serverUrl = getServerUrl(storedMode);
        const response = await axios.get(`${serverUrl}/api/users`);
        const ldapUsers = response.data.map(user => ({
          name: user.name || user.uid,
          id: user.uid,
          email: user.email || 'Non défini',
          role: user.role || 'User'
        }));
        setUsers(ldapUsers);
        setLoading(false);
      } catch (err) {
        console.error('Erreur lors du chargement des utilisateurs:', err);
        setError('Erreur lors du chargement des utilisateurs. Veuillez vérifier votre connexion au serveur.');
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const selectUser = (userId, userName) => {
    const userObj = users.find(user => user.id === userId);
    setSelectedUser(userObj);
    setShowPasswordModal(true);
    setMessage('');
  };

  const authenticateUser = async () => {
    if (!selectedUser || !password) {
      setMessage('Veuillez entrer un mot de passe');
      setMessageType('error');
      return;
    }

    setAuthenticating(true);
    setMessage('');

    try {
      // Utiliser l'URL du serveur en fonction du mode d'accès
      const serverUrl = getServerUrl(accessMode);
      const response = await axios.post(`${serverUrl}/api/authenticate`, {
        uid: selectedUser.id,
        password: password
      });

      if (response.data && response.data.message === "Authentification réussie") {
        // Authentification réussie, procéder à l'ouverture de la fenêtre
        setMessage('Authentification réussie. Ouverture de la session...');
        setMessageType('success');
        await openUserWindow(selectedUser.id, selectedUser.name);
        setShowPasswordModal(false);
        setPassword('');
        setLoginAttempts(0);
      } else {
        setLoginAttempts(prev => prev + 1);
        setMessage('Échec de l\'authentification. Mot de passe incorrect.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Erreur d\'authentification:', error);
      setLoginAttempts(prev => prev + 1);
      
      // Gestion détaillée des erreurs
      if (error.response) {
        // Le serveur a répondu avec un code d'erreur
        if (error.response.status === 401) {
          setMessage('Identifiants incorrects. Veuillez réessayer.');
        } else if (error.response.status === 429) {
          setMessage('Trop de tentatives de connexion. Veuillez réessayer plus tard.');
        } else {
          setMessage(`Erreur d'authentification: ${error.response.data?.message || 'Erreur serveur'}`);
        }
      } else if (error.request) {
        // La requête a été faite mais pas de réponse
        setMessage('Impossible de contacter le serveur. Veuillez vérifier votre connexion.');
      } else {
        // Erreur lors de la configuration de la requête
        setMessage(`Erreur: ${error.message}`);
      }
      
      setMessageType('error');
    } finally {
      setAuthenticating(false);
    }
  };

  const openUserWindow = async (userId, userName) => {
    try {
      console.log(`Ouverture de session pour: ${userName}`);
      
      // Stocker le nom de l'utilisateur dans localStorage
      localStorage.setItem('currentUser', userId);
      
      
      // Récupérer le mode d'accès actuel (privé ou public)
      const accessMode = localStorage.getItem('accessMode') || 'private';
      const userObj = users.find(user => user.id === userId);
      const userRole = userObj ? userObj.role : '';
      localStorage.setItem('currentUserRole', userRole);
      console.log('userRole', userRole);
      
      // Ouvrir une nouvelle fenêtre pour cet utilisateur avec le mode d'accès spécifié
      await window.electronAPI.invoke('create-user-window-with-mode', userName, accessMode, userRole);
      setMessage(`Fenêtre ouverte pour ${userName} en mode ${accessMode} avec le rôle ${userRole}`);
      setMessageType('success');
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la fenêtre:', error);
      setMessage(`Erreur lors de l'ouverture de la fenêtre: ${error.message}`);
      setMessageType('error');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <p className="error-text">{error}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="login-card">
        <h1 className="title-connexion">Ouvrir une nouvelle session</h1>
        
        <div className="user-buttons-container">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => selectUser(user.id, user.name)}
              className={`user-button ${user.name === currentUser ? 'primary-user-button' : ''}`}
            >
              <div className="user-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-name">
                {user.name}
                <span className="user-role">{user.role}</span>
              </div>
            </button>
          ))}
        </div>
        
        {message && (
          <div className={`message-container ${messageType === 'error' ? 'error-message' : ''} ${messageType === 'success' ? 'success-message' : ''}`}>
            <p className="message-text">{message}</p>
          </div>
        )}
        
        <button 
          onClick={() => navigate('/home')} 
          className="return-button"
        >
          Retour à l'accueil
        </button>
      </div>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => !authenticating && setShowPasswordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Authentification</h2>
            <div className="user-info">
              <div className={`modal-user-avatar ${selectedUser.id === 'jules' ? 'primary-user-avatar' : ''}`}>
                {selectedUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="modal-user-name">{selectedUser.name}</div>
            </div>
            
            <p className="modal-text">Veuillez entrer votre mot de passe</p>
            
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="password-input"
              placeholder="Mot de passe"
              onKeyPress={(e) => e.key === 'Enter' && authenticateUser()}
              autoFocus
            />
            
            {loginAttempts > 0 && (
              <p className="attempt-warning">
                {loginAttempts === 1 ? 'Première tentative échouée' : 
                 loginAttempts === 2 ? 'Deuxième tentative échouée' : 
                 'Attention: Plusieurs tentatives échouées'}
              </p>
            )}
            
            <div className="modal-buttons">
              <button 
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setSelectedUser(null);
                  setLoginAttempts(0);
                }}
                className="cancel-button"
                disabled={authenticating}
              >
                Annuler
              </button>
              <button 
                onClick={authenticateUser}
                className="login-button"
                disabled={authenticating || !password}
              >
                {authenticating ? (
                  <div className="button-spinner"></div>
                ) : 'Se connecter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserLogin;
