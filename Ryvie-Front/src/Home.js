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
const Icon = ({ id, src, index, zoneId, moveIcon }) => {
  const ref = React.useRef(null);

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.ICON,
    item: { id, index, zoneId },
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
const Zone = ({ zoneId, icons, moveIcon }) => {
  const [, drop] = useDrop({
    accept: ItemTypes.ICON,
    drop: (item, monitor) => {
      if (item.zoneId !== zoneId) {
        moveIcon(item.id, item.zoneId, zoneId);
        item.zoneId = zoneId;
      }
    },
  });

  return (
    <div ref={drop} className="zone">
      <div className="zone-title">Zone {zoneId}</div>
      <div className="icon-container">
        {icons.map((iconId, index) => (
          <Icon
            key={iconId}
            id={iconId}
            src={images[iconId]}
            index={index}
            zoneId={zoneId}
            moveIcon={moveIcon}
          />
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  // État pour stocker les icônes dans chaque zone
  const [zones, setZones] = useState({
    1: Object.keys(images).slice(0, 2), // Zone 1 avec les deux premières icônes
    2: Object.keys(images).slice(2),    // Zone 2 avec le reste des icônes
  });


  const moveIcon = (id, fromZoneId, toZoneId) => {
    setZones((prevZones) => {
      const fromIcons = prevZones[fromZoneId].filter((iconId) => iconId !== id);
      const toIcons = [...prevZones[toZoneId], id];
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
        {/* Contenu de la page */}
        <div className="background">
          <h1 className="title">Bienvenue sur Ryvie</h1>
          {/* Widget au milieu de la page */}
          <div className="widget">
            <h2 className="widget-title">Météo Actuelle</h2>
            <p className="widget-content">Paris, 15°C, Ensoleillé</p>
          </div>
          {/* Zones pour les icônes */}
          <div className="zones-container">
            {Object.keys(zones).map((zoneId) => (
              <Zone
                key={zoneId}
                zoneId={zoneId}
                icons={zones[zoneId]}
                moveIcon={moveIcon}
              />
            ))}
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default Home;
