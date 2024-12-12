import React, { useState } from 'react';
import './styles/User.css';
import { useNavigate } from 'react-router-dom';

const User = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState([
    { id: 1, name: 'Jules Dupont', email: 'jules.dupont@example.com', role: 'Admin' },
    { id: 2, name: 'Marie Curie', email: 'marie.curie@example.com', role: 'User' },
  ]);

  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'User' });
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  return (
    <div className="user-body">
    <div className="user-container">
      {/* Barre supérieure */}
      <div className="top-bar">
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
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editUser ? 'Modifier un utilisateur' : 'Ajouter un utilisateur'}</h2>
              <button className="close-btn" onClick={() => setFormOpen(false)}>✖</button>
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
              <td>{user.name}</td>
              <td>{user.email}</td>
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
                >
                  ✏️
                </span>
                <span
                  className="action-icon delete-icon"
                  onClick={() => setConfirmDelete(user)}
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
    
  );
};

export default User;