import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UserLogin = () => {
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Définir Jules comme utilisateur par défaut
    localStorage.setItem('currentUser', 'Jules');
    
    const fetchUsers = async () => {
      try {
        const response = await axios.get('http://ryvie.local:3002/api/users');
        const ldapUsers = response.data.map(user => ({
          name: user.name || user.uid,
          id: user.uid,
          email: user.email || 'Non défini',
          role: user.role || 'User'
        }));
        setUsers(ldapUsers);
        setLoading(false);
      } catch (err) {
        setError('Erreur lors du chargement des utilisateurs');
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const openUserWindow = async (userId, userName) => {
    try {
      console.log(`Ouverture de session pour: ${userName}`);
      
      // Stocker le nom de l'utilisateur dans localStorage
      localStorage.setItem('currentUser', userName);
      
      // Récupérer le mode d'accès actuel (privé ou public)
      const accessMode = localStorage.getItem('accessMode') || 'private';
      
      // Ouvrir une nouvelle fenêtre pour cet utilisateur avec le mode d'accès spécifié
      await window.electronAPI.invoke('create-user-window-with-mode', userName, accessMode);
      setMessage(`Fenêtre ouverte pour ${userName} en mode ${accessMode}`);
    } catch (error) {
      setMessage(`Erreur : ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Chargement des utilisateurs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Ouvrir une nouvelle session</h1>
      <div style={styles.form}>
        {users.map(user => (
          <button
            key={user.id}
            onClick={() => openUserWindow(user.id, user.name)}
            style={{
              ...styles.button,
              ...(user.id === 'jules' ? styles.primaryButton : {})
            }}
          >
            Ouvrir session {user.name}
          </button>
        ))}
      </div>
      {message && <p style={styles.message}>{message}</p>}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#f9f9f9',
    padding: '20px',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '300px',
  },
  button: {
    padding: '10px',
    fontSize: '1rem',
    borderRadius: '5px',
    border: 'none',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  primaryButton: {
    backgroundColor: '#28a745',
  },
  message: {
    marginTop: '20px',
    padding: '10px',
    borderRadius: '5px',
    backgroundColor: '#e9ecef',
    color: '#495057',
  },
  error: {
    color: '#dc3545',
    padding: '10px',
    borderRadius: '5px',
    backgroundColor: '#f8d7da',
  }
};

export default UserLogin;
