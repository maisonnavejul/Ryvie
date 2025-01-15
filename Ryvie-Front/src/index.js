import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import User from './User';
import Settings from './Settings';
import Welcome from './welcome'; // Import du composant Welcome
import Login from './connexion'; // Import du composant Login

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/home" element={<Home />} />
      <Route path="/user" element={<User />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/login" element={<Login />} />

    </Routes>
  </Router>
);

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
