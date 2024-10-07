// Home.js

import React, { useState } from 'react';
import './Home.css';

import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

// Fonction pour importer toutes les images du dossier icons
const importAll = (r) => {
  let images = {};
  r.keys().forEach((item) => {
    images[item.replace('./', '')] = r(item);
  });
  return images;
};

const images = importAll(require.context('./icons', false, /\.(png|jpe?g|svg)$/));

// Types pour react-dnd
const ItemTypes = {
  ICON: 'icon',
};

// Composant pour chaque icône
const Icon = ({ id, src, zoneId, moveIcon }) => {
  const ref = React.useRef(null);

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.ICON,
    item: { id, zoneId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(ref);

  return (
    <div
      ref={ref}
      className="icon"
      style={{
        backgroundImage: `url(${src})`,
        opacity: isDragging ? 0.5 : 1,
      }}
    ></div>
  );
};

// Composant pour chaque zone
const Zone = ({ zoneId, iconId, moveIcon }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemTypes.ICON,
    canDrop: () => true, // Accepte le drop même si la zone est occupée
    drop: (item) => {
      if (item.id !== iconId[0] || item.zoneId !== zoneId) {
        moveIcon(item.id, item.zoneId, zoneId);
        item.zoneId = zoneId;
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const isActive = canDrop && isOver;

  return (
    <div
      ref={drop}
      className={`zone ${isActive ? 'zone-active' : ''}`}
    >
      {/* Affichage de l'icône si elle est présente */}
      <div className="icon-container">
        {iconId.length > 0 && (
          <Icon
            id={iconId[0]}
            src={images[iconId[0]]}
            zoneId={zoneId}
            moveIcon={moveIcon}
          />
        )}
      </div>
    </div>
  );
};

const Taskbar = () => {
  // Exemple d'images pour les cercles
  const taskbarIcons = [
    images['appstore.jpeg'],
    images['drive.png'],
    images['cloud.png'],
    images['user.png'],
    images['settings.png'],
  ];

  return (
    <div className="taskbar">
      {taskbarIcons.map((iconSrc, index) => (
        <div key={index} className="taskbar-circle">
          <img src={iconSrc} alt={`Icon ${index}`} />
        </div>
      ))}
    </div>
  );
};

const Home = () => {
  // État pour stocker les icônes dans chaque zone
  const [zones, setZones] = useState({
    left: ['appstore.jpeg'], // Application placée par défaut à gauche du widget
    right: ['drive.png'], // Application placée par défaut à droite du widget
    bottom1: ['cloud.png'], // Application placée par défaut dans la première zone du bas
    bottom2: [],
    bottom3: [],
    bottom4: [],
    bottom5: [],
    bottom6: [],
    bottom7: [],
    bottom8: [],
    bottom9: [],
    bottom10: [],
    apps: Object.keys(images).filter(
      (iconId) => !['appstore.jpeg', 'drive.png', 'cloud.png'].includes(iconId)
    ), // Applications restantes dans la zone "Applications"
  });

  const moveIcon = (id, fromZoneId, toZoneId) => {
    setZones((prevZones) => {
      const fromIcons = prevZones[fromZoneId].filter((iconId) => iconId !== id);
      let toIcons = prevZones[toZoneId];

      if (!toIcons) toIcons = [];

      if (toIcons.length === 0) {
        // La zone cible est vide, on y ajoute l'icône
        toIcons = [id];
      } else {
        // La zone cible contient déjà une icône, on l'échange
        const [existingIconId] = toIcons;
        toIcons = [id];
        fromIcons.push(existingIconId);
      }

      return {
        ...prevZones,
        [fromZoneId]: fromIcons,
        [toZoneId]: toIcons,
      };
    });
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="home-container">
        <div className="background">
          {/* Ajout du composant Taskbar */}
          <Taskbar />
          {/* Ajout de la classe content */}
          <div className="content">
            <h1 className="title">Bienvenue dans votre Cloud</h1>
            <div className="main-content">
              {/* Zone à gauche du widget */}
              <Zone zoneId="left" iconId={zones['left']} moveIcon={moveIcon} />
              {/* Widget central */}
              <div className="widget">
                <h2 className="widget-title">Météo Actuelle</h2>
                <p className="widget-content">Paris, 15°C, Ensoleillé</p>
              </div>
              {/* Zone à droite du widget */}
              <Zone zoneId="right" iconId={zones['right']} moveIcon={moveIcon} />
            </div>
            {/* Zones sous le widget */}
            <div className="bottom-zones">
              {Array.from({ length: 10 }, (_, i) => (
                <Zone
                  key={`bottom${i + 1}`}
                  zoneId={`bottom${i + 1}`}
                  iconId={zones[`bottom${i + 1}`]}
                  moveIcon={moveIcon}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default Home;
