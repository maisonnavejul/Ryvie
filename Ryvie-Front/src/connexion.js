import React, { useState } from 'react';

const UserLogin = () => {
  const [message, setMessage] = useState('');

  const openUserWindow = async (userId) => {
    try {
      await window.electronAPI.invoke('create-user-window', userId);
      setMessage(`Fenêtre ouverte pour ${userId}`);
    } catch (error) {
      setMessage(`Erreur : ${error.message}`);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Ouvrir une nouvelle session</h1>
      <div style={styles.form}>
        <button 
          onClick={() => openUserWindow('cynthia')} 
          style={styles.button}
        >
          Ouvrir session Cynthia
        </button>
      </div>
      {message && <p style={styles.message}>{message}</p>}
      <p style={styles.info}>
        La session de Jules est déjà ouverte par défaut.
      </p>
    </div>
  );
};

// Styles pour le composant
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
    '&:hover': {
      backgroundColor: '#0056b3',
    }
  },
  message: {
    marginTop: '20px',
    padding: '10px',
    borderRadius: '5px',
    backgroundColor: '#e9ecef',
    color: '#495057',
  },
  info: {
    marginTop: '15px',
    color: '#6c757d',
    fontStyle: 'italic',
  }
};

export default UserLogin;
