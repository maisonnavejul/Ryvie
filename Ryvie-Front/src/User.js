import React, { useState, useEffect, useRef } from 'react';
import './styles/User.css';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const { getServerUrl } = require('./config/urls');

const User = () => {
  const navigate = useNavigate();

  // Liste des utilisateurs récupérée depuis l'API
  const [users, setUsers] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'User' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true); // Indicateur de chargement
  const [error, setError] = useState(null); // Gestion des erreurs
  const [accessMode, setAccessMode] = useState('private');
  
  // Références pour les animations
  const topBarRef = useRef(null);
  const userListRef = useRef(null);
  const userFormRef = useRef(null);
  
  // Animation d'entrée
  useEffect(() => {
    // Effet d'animation séquentiel
    const topBarElement = topBarRef.current;
    const userListElement = userListRef.current;
    
    if (topBarElement) {
      topBarElement.style.opacity = '0';
      topBarElement.style.transform = 'translateY(-20px)';
      
      setTimeout(() => {
        topBarElement.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        topBarElement.style.opacity = '1';
        topBarElement.style.transform = 'translateY(0)';
      }, 100);
    }
    
    if (userListElement) {
      userListElement.style.opacity = '0';
      
      setTimeout(() => {
        userListElement.style.transition = 'opacity 0.8s ease';
        userListElement.style.opacity = '1';
      }, 400);
    }
    
    // Effet d'animation pour le formulaire quand il s'ouvre
    if (formOpen && userFormRef.current) {
      userFormRef.current.style.opacity = '0';
      userFormRef.current.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        userFormRef.current.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        userFormRef.current.style.opacity = '1';
        userFormRef.current.style.transform = 'translateY(0)';
      }, 100);
    }
  }, [formOpen]);

  // Récupération des utilisateurs depuis l'API
  useEffect(() => {
    // Récupérer le mode d'accès depuis le localStorage
    const storedMode = localStorage.getItem('accessMode') || 'private';
    setAccessMode(storedMode);
    
    const fetchUsers = async () => {
      try {
        // Utiliser l'URL du serveur en fonction du mode d'accès
        const serverUrl = getServerUrl(storedMode);
        console.log("Connexion à :", serverUrl);
        
        const response = await axios.get(`${serverUrl}/api/users`); // URL de l'API backend
        const ldapUsers = response.data.map((user, index) => ({
          id: index + 1,
          name: user.name || user.uid,
          email: user.email || 'Non défini',
          role: user.role || 'Unknown',
        }));
        setUsers(ldapUsers);
        setLoading(false);
      } catch (err) {
        console.error('Erreur lors du chargement des utilisateurs:', err);
        setError('Erreur lors du chargement des utilisateurs');
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const openAddUserForm = () => {
    setEditUser(null);
    setNewUser({ name: '', email: '', role: 'User' });
    setFormOpen(true);
  };

  const handleAddUser = () => {
    if (editUser) {
      setUsers(users.map((user) => (user.id === editUser.id ? { ...user, ...newUser } : user)));
    } else {
      setUsers([...users, { id: Date.now(), ...newUser }]);
    }
    setFormOpen(false);
    setNewUser({ name: '', email: '', role: 'User' });
  };

  const handleRoleChange = (id, role) => {
    setUsers(users.map((user) => (user.id === id ? { ...user, role } : user)));
  };

  const handleDeleteUser = (id) => {
    setUsers(users.filter((user) => user.id !== id));
    setConfirmDelete(null);
  };

  if (loading) {
    return <p>Chargement des utilisateurs...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className="user-body">
      <div className="user-container">
        {/* Barre supérieure */}
        <div ref={topBarRef} className="top-bar">
          <div className="back-btn-container">
            <button className="back-btn" onClick={() => navigate('/home')}>
              ← Retour au Home
            </button>
          </div>
          <div className="top-bar-content">
            <h1>Gestion des utilisateurs</h1>
            <p>Gérez les utilisateurs et leurs permissions</p>
          </div>
          <div className="add-user-btn">
            <button onClick={openAddUserForm}>Ajouter un utilisateur</button>
          </div>
        </div>

        {/* Formulaire d'ajout/modification d'utilisateur */}
        {formOpen && (
          <div ref={userFormRef} className="modal-overlay" onClick={() => setFormOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editUser ? 'Modifier un utilisateur' : 'Ajouter un utilisateur'}</h2>
                <button className="close-btn" onClick={() => setFormOpen(false)}>
                  ✖
                </button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  placeholder="Nom"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="role-select"
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                  <option value="Guest">Guest</option>
                </select>
                <button className="submit-btn" onClick={handleAddUser}>
                  {editUser ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation de suppression */}
        {confirmDelete && (
          <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Confirmer la suppression</h3>
              <p>Êtes-vous sûr de vouloir supprimer {confirmDelete.name} ?</p>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setConfirmDelete(null)}>
                  Annuler
                </button>
                <button className="delete-btn" onClick={() => handleDeleteUser(confirmDelete.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tableau des utilisateurs */}
        <div ref={userListRef} className="table-container">
          <table className="user-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td title={user.name}>{user.name}</td>
                  <td title={user.email}>{user.email}</td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className={`role-select ${user.role.toLowerCase()}`}
                    >
                      <option value="User">User</option>
                      <option value="Admin">Admin</option>
                      <option value="Guest">Guest</option>
                    </select>
                  </td>
                  <td>
                    <span
                      className="action-icon edit-icon"
                      onClick={() => {
                        setEditUser(user);
                        setNewUser(user);
                        setFormOpen(true);
                      }}
                      title="Modifier"
                    >
                      ✏️
                    </span>
                    <span
                      className="action-icon delete-icon"
                      onClick={() => setConfirmDelete(user)}
                      title="Supprimer"
                    >
                      🗑️
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default User;
