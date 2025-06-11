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
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    role: 'User',
    uid: '',
    cn: '',
    sn: '',
    mail: '',
    password: '',
    confirmPassword: ''
  });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true); // Indicateur de chargement
  const [error, setError] = useState(null); // Gestion des erreurs
  const [accessMode, setAccessMode] = useState('private');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ uid: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteAuthModal, setShowDeleteAuthModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
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

  // Fonction pour récupérer les utilisateurs depuis l'API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Récupérer le mode d'accès depuis le localStorage
      const storedMode = localStorage.getItem('accessMode') || 'private';
      setAccessMode(storedMode);
      
      // Utiliser l'URL du serveur en fonction du mode d'accès
      const serverUrl = getServerUrl(storedMode);
      console.log("Connexion à :", serverUrl);
      
      const response = await axios.get(`${serverUrl}/api/users`); // URL de l'API backend
      const ldapUsers = response.data.map((user, index) => ({
        id: index + 1,
        name: user.name || user.cn || user.uid,
        email: user.email || user.mail || 'Non défini',
        role: user.role || 'User',
        uid: user.uid
      }));
      setUsers(ldapUsers);
      setLoading(false);
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      setError('Erreur lors du chargement des utilisateurs');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAddUserForm = () => {
    setEditUser(null);
    setNewUser({ 
      name: '', 
      email: '', 
      role: 'User',
      uid: '',
      cn: '',
      sn: '',
      mail: '',
      password: '',
      confirmPassword: ''
    });
    setFormOpen(true);
    setMessage('');
  };

  const validateUserForm = () => {
    // Validation des champs obligatoires
    if (!newUser.name.trim()) {
      setMessage('Le nom complet est requis');
      setMessageType('error');
      return false;
    }
    
    if (!newUser.uid.trim()) {
      setMessage('L\'identifiant (uid) est requis');
      setMessageType('error');
      return false;
    }
    
    if (!newUser.email.trim()) {
      setMessage('L\'email est requis');
      setMessageType('error');
      return false;
    }
    
    if (!newUser.password) {
      setMessage('Le mot de passe est requis');
      setMessageType('error');
      return false;
    }
    
    if (newUser.password !== newUser.confirmPassword) {
      setMessage('Les mots de passe ne correspondent pas');
      setMessageType('error');
      return false;
    }
    
    // Validation du format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUser.email)) {
      setMessage('Format d\'email invalide');
      setMessageType('error');
      return false;
    }
    
    // Validation de l'identifiant (uid) - lettres, chiffres, tirets, underscores
    const uidRegex = /^[a-z0-9_-]+$/;
    if (!uidRegex.test(newUser.uid)) {
      setMessage('L\'identifiant doit contenir uniquement des lettres minuscules, chiffres, tirets ou underscores');
      setMessageType('error');
      return false;
    }
    
    return true;
  };

  const handleAddUser = async () => {
    if (!validateUserForm()) {
      return;
    }

    // Récupérer l'utilisateur actuel depuis localStorage pour pré-remplir les identifiants admin
    const currentUser = localStorage.getItem('currentUser') || '';
    
    // Pré-remplir les identifiants admin avec l'utilisateur actuel
    setAdminCredentials({ 
      uid: currentUser,
      password: '' 
    });

    // Ouvrir le modal d'authentification admin
    setShowAdminAuthModal(true);
  };

  const submitUserWithAdminAuth = async () => {
    if (!adminCredentials.uid || !adminCredentials.password) {
      setMessage('Veuillez entrer vos identifiants administrateur');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      // Préparer les données pour l'API selon le format requis
      const payload = {
        adminUid: adminCredentials.uid,
        adminPassword: adminCredentials.password,
        newUser: {
          cn: newUser.name,
          sn: newUser.name.split(' ').pop() || newUser.name,
          uid: newUser.uid,
          mail: newUser.email,
          password: newUser.password,
          role: newUser.role
        }
      };

      // Utiliser l'URL du serveur en fonction du mode d'accès
      const serverUrl = getServerUrl(accessMode);
      
      // Appel à l'API pour ajouter l'utilisateur avec authentification admin
      const response = await axios.post(`${serverUrl}/api/add-user`, payload);

      // Traitement de la réponse
      if (response.data && response.data.message) {
        // Fermer les modals et réinitialiser les états
        setFormOpen(false);
        setShowAdminAuthModal(false);
        setNewUser({ 
          name: '', 
          email: '', 
          role: 'User',
          uid: '',
          cn: '',
          sn: '',
          mail: '',
          password: '',
          confirmPassword: ''
        });
        setAdminCredentials({ uid: '', password: '' });
        
        // Afficher le message de succès
        setMessage(response.data.message);
        setMessageType('success');
        
        // Mise à jour de la liste des utilisateurs
        fetchUsers();
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout de l\'utilisateur:', err);
      
      // Gestion détaillée des erreurs
      if (err.response) {
        if (err.response.status === 401) {
          setMessage(err.response.data?.error || 'Identifiants administrateur incorrects');
        } else if (err.response.status === 403) {
          setMessage(err.response.data?.error || 'Vous n\'avez pas les droits administrateur nécessaires');
        } else if (err.response.status === 409) {
          setMessage(err.response.data?.error || 'Cet utilisateur existe déjà');
        } else if (err.response.status === 400) {
          setMessage(err.response.data?.error || 'Données invalides. Vérifiez les champs requis.');
        } else {
          setMessage(err.response.data?.error || 'Erreur lors de l\'ajout de l\'utilisateur');
        }
      } else {
        setMessage('Erreur de connexion au serveur');
      }
      
      setMessageType('error');
      // Ne pas fermer le modal en cas d'erreur
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = (id, role) => {
    setUsers(users.map((user) => (user.id === id ? { ...user, role } : user)));
  };

  const confirmDeleteUser = (user) => {
    setConfirmDelete(user);
  };

  const handleDeleteUser = () => {
    if (!confirmDelete) return;
    
    // Récupérer l'utilisateur actuel depuis localStorage pour pré-remplir les identifiants admin
    const currentUser = localStorage.getItem('currentUser') || '';
    
    // Pré-remplir les identifiants admin avec l'utilisateur actuel
    setAdminCredentials({ 
      uid: currentUser,
      password: '' 
    });
    
    // Stocker l'utilisateur à supprimer et ouvrir le modal d'authentification
    setUserToDelete(confirmDelete);
    setShowDeleteAuthModal(true);
    setConfirmDelete(null);
  };

  const deleteUserWithAdminAuth = async () => {
    if (!adminCredentials.uid || !adminCredentials.password || !userToDelete) {
      setMessage('Informations manquantes pour la suppression');
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      // Préparer les données pour l'API
      const payload = {
        adminUid: adminCredentials.uid,
        adminPassword: adminCredentials.password,
        uid: userToDelete.uid
      };

      // Utiliser l'URL du serveur en fonction du mode d'accès
      const serverUrl = getServerUrl(accessMode);
      
      // Appel à l'API pour supprimer l'utilisateur
      const response = await axios.post(`${serverUrl}/api/delete-user`, payload);

      // Traitement de la réponse
      if (response.data && response.data.message) {
        // Fermer le modal et réinitialiser les états
        setShowDeleteAuthModal(false);
        setUserToDelete(null);
        setAdminCredentials({ uid: '', password: '' });
        
        // Afficher le message de succès
        setMessage(response.data.message);
        setMessageType('success');
        
        // Mise à jour de la liste des utilisateurs
        fetchUsers();
      }
    } catch (err) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', err);
      
      // Gestion détaillée des erreurs
      if (err.response) {
        if (err.response.status === 401) {
          setMessage(err.response.data?.error || 'Identifiants administrateur incorrects');
        } else if (err.response.status === 403) {
          setMessage(err.response.data?.error || 'Vous n\'avez pas les droits administrateur nécessaires');
        } else if (err.response.status === 404) {
          setMessage(err.response.data?.error || 'Utilisateur non trouvé');
        } else if (err.response.status === 400) {
          setMessage(err.response.data?.error || 'Données invalides pour la suppression');
        } else {
          setMessage(err.response.data?.error || 'Erreur lors de la suppression de l\'utilisateur');
        }
      } else {
        setMessage('Erreur de connexion au serveur');
      }
      
      setMessageType('error');
      // Ne pas fermer le modal en cas d'erreur
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="user-body">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-body">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button className="retry-button" onClick={fetchUsers}>Réessayer</button>
        </div>
      </div>
    );
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

        {/* Message de notification */}
        {message && (
          <div className={`notification-message ${messageType === 'error' ? 'error-message' : 'success-message'}`}>
            <p>{message}</p>
            <button className="close-notification" onClick={() => setMessage('')}>×</button>
          </div>
        )}

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
                {/* Affichage du message d'erreur dans le formulaire */}
                {message && messageType === 'error' && (
                  <div className="modal-error-message">
                    <p>{message}</p>
                  </div>
                )}
                
                <input
                  type="text"
                  placeholder="Nom complet"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Identifiant (uid)"
                  value={newUser.uid}
                  onChange={(e) => setNewUser({ ...newUser, uid: e.target.value })}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value, mail: e.target.value })}
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
                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
                <input
                  type="password"
                  placeholder="Confirmer le mot de passe"
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                />
                <button className="submit-btn" onClick={handleAddUser}>
                  {editUser ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal d'authentification admin */}
        {showAdminAuthModal && (
          <div className="modal-overlay" onClick={() => !isSubmitting && setShowAdminAuthModal(false)}>
            <div className="modal-content admin-auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Authentification Administrateur</h2>
                <button className="close-btn" onClick={() => !isSubmitting && setShowAdminAuthModal(false)}>
                  ✖
                </button>
              </div>
              <div className="modal-body">
                <p>Veuillez vous authentifier en tant qu'administrateur pour ajouter un nouvel utilisateur</p>
                
                {/* Affichage du message d'erreur dans le modal */}
                {message && messageType === 'error' && (
                  <div className="modal-error-message">
                    <p>{message}</p>
                  </div>
                )}
                
                <input
                  type="text"
                  placeholder="Identifiant admin"
                  value={adminCredentials.uid}
                  onChange={(e) => setAdminCredentials({ ...adminCredentials, uid: e.target.value })}
                  disabled={isSubmitting}
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Mot de passe admin"
                  value={adminCredentials.password}
                  onChange={(e) => setAdminCredentials({ ...adminCredentials, password: e.target.value })}
                  disabled={isSubmitting}
                  onKeyPress={(e) => e.key === 'Enter' && submitUserWithAdminAuth()}
                />
                <div className="admin-auth-buttons">
                  <button 
                    className="cancel-btn" 
                    onClick={() => {
                      setShowAdminAuthModal(false);
                      setMessage('');
                    }}
                    disabled={isSubmitting}
                  >
                    Annuler
                  </button>
                  <button 
                    className="submit-btn" 
                    onClick={submitUserWithAdminAuth}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Traitement en cours...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation de suppression */}
        {confirmDelete && (
          <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Confirmer la suppression</h3>
              <p>Êtes-vous sûr de vouloir supprimer {confirmDelete.name} ?</p>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setConfirmDelete(null)}>
                  Annuler
                </button>
                <button className="delete-btn" onClick={handleDeleteUser}>
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal d'authentification admin pour la suppression */}
        {showDeleteAuthModal && (
          <div className="modal-overlay" onClick={() => !isSubmitting && setShowDeleteAuthModal(false)}>
            <div className="modal-content admin-auth-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Authentification Administrateur</h2>
                <button className="close-btn" onClick={() => !isSubmitting && setShowDeleteAuthModal(false)}>
                  ✖
                </button>
              </div>
              <div className="modal-body">
                <p>Veuillez vous authentifier en tant qu'administrateur pour supprimer l'utilisateur <strong>{userToDelete?.name}</strong></p>
                
                {/* Affichage du message d'erreur dans le modal */}
                {message && messageType === 'error' && (
                  <div className="modal-error-message">
                    <p>{message}</p>
                  </div>
                )}
                
                <input
                  type="text"
                  placeholder="Identifiant admin"
                  value={adminCredentials.uid}
                  onChange={(e) => setAdminCredentials({ ...adminCredentials, uid: e.target.value })}
                  disabled={isSubmitting}
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Mot de passe admin"
                  value={adminCredentials.password}
                  onChange={(e) => setAdminCredentials({ ...adminCredentials, password: e.target.value })}
                  disabled={isSubmitting}
                  onKeyPress={(e) => e.key === 'Enter' && deleteUserWithAdminAuth()}
                />
                <div className="admin-auth-buttons">
                  <button 
                    className="cancel-btn" 
                    onClick={() => {
                      setShowDeleteAuthModal(false);
                      setMessage('');
                      setUserToDelete(null);
                    }}
                    disabled={isSubmitting}
                  >
                    Annuler
                  </button>
                  <button 
                    className="submit-btn delete-btn" 
                    onClick={deleteUserWithAdminAuth}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Traitement en cours...' : 'Confirmer la suppression'}
                  </button>
                </div>
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
                      onClick={() => confirmDeleteUser(user)}
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
