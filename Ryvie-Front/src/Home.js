import React, { useState, useEffect } from 'react';
import './Home.css';
import axios from 'axios'; // Importer axios
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
const weatherImages = importAll(require.context('./weather_icons', false, /\.(png|jpe?g|svg)$/)); // Ajoute des images pour la météo
const weatherIcons = importAll(require.context('./weather_icons', false, /\.(png|jpe?g|svg)$/)); // Ajoute des images pour la météo et les icônes

// Types pour react-dnd
const ItemTypes = {
  ICON: 'icon',
};

// Composant pour chaque icône
const Icon = ({ id, src, zoneId, moveIcon, handleClick }) => {
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
        cursor: 'pointer', // Ajoute le pointeur sur chaque icône
      }}
      onClick={() => handleClick(id)} // Gestionnaire de clic
    ></div>
  );
};

// Composant pour chaque zone
const Zone = ({ zoneId, iconId, moveIcon, handleClick }) => {
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
            handleClick={handleClick} // Passe la fonction de clic à l'icône
          />
        )}
      </div>
    </div>
  );
};

const Taskbar = ({ handleClick }) => {
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
        <div 
          key={index} 
          className="taskbar-circle"
          onClick={() => handleClick(Object.keys(images)[index])} // Gère le clic sur les icônes de la barre des tâches
        >
          <img src={iconSrc} alt={`Icon ${index}`} />
        </div>
      ))}
    </div>
  );
};

const Home = () => {
  const [zones, setZones] = useState({
    left: ['appstore.jpeg'], // Application placée par défaut à gauche du widget
    right: ['drive.png'], // Application placée par défaut à droite du widget
    bottom1: ['cloud.png'], // Application placée par défaut dans la première zone du bas
    bottom2: ['portainer.png'], // Application placée par défaut dans la deuxième zone du bas
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

  const [weather, setWeather] = useState({
    location: 'Loading...',
    temperature: null,
    description: '',
    icon: 'default.png',
  });

  const [hourlyForecast, setHourlyForecast] = useState([]);
  const [showHourly, setShowHourly] = useState(false);

  // Utiliser l'API IP-API pour obtenir la localisation
  useEffect(() => {
    const geoApiUrl = 'http://ip-api.com/json';
  
    axios.get(geoApiUrl).then((response) => {
      const { city, lat, lon } = response.data;
  
      const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode,relative_humidity_2m,windspeed_10m&timezone=auto`;

      axios.get(weatherApiUrl).then((weatherResponse) => {
        const data = weatherResponse.data;
  
        // Météo actuelle
        const weatherCode = data.current_weather.weathercode;
        let icon = 'sunny.png'; // Image par défaut
  
        if (weatherCode >= 1 && weatherCode <= 3) {
          icon = 'cloudy.png';
        } else if (weatherCode === 61 || weatherCode === 63 || weatherCode === 65) {
          icon = 'rainy.png';
        }
  
        setWeather({
          location: city,
          temperature: data.current_weather.temperature,
          humidity: data.hourly.relative_humidity_2m[0],// Ajout de l'humidité
          wind: data.current_weather.windspeed, // Ajout de la vitesse du vent
          description: weatherCode,
          icon: icon,
        });
      });
    }).catch((error) => {
      console.error("Erreur lors de la récupération de la localisation", error);
      setWeather({
        location: 'Localisation non disponible',
        temperature: null,
        humidity: null,
        wind: null, // Assure que le vent est défini
        description: '',
        icon: 'default.png',
      });
    });
  }, []);
  

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

  // Fonction pour gérer le clic sur les icônes
  const handleClick = (iconId) => {
    if (iconId === 'cloud.png') {
      window.open('http://207.180.204.159:8081/app1/', '_blank'); // Ouvre l'URL lors du clic sur l'icône "cloud"
    }
    // Tu peux ajouter d'autres actions pour d'autres icônes si nécessaire
    if (iconId === 'portainer.png') {
      window.open('http://207.180.204.159:8081/app3/', '_blank');
    }
  };

  // Fonction pour afficher ou masquer la météo heure par heure
  const toggleHourlyForecast = () => {
    setShowHourly(!showHourly);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="home-container">
        <div className="background">
          <Taskbar handleClick={handleClick} />
          <div className="content">
            <h1 className="title">Bienvenue dans votre Cloud</h1>
            <div className="main-content">
              <Zone 
                zoneId="left" 
                iconId={zones['left']} 
                moveIcon={moveIcon} 
                handleClick={handleClick} 
              />
<div className="widget" style={{
  backgroundImage: `url(${weatherImages[weather.icon]})`,
}}>
  <div className="weather-info">
    <p className="weather-city">
      {weather.location ? weather.location : 'Localisation non disponible'}
    </p>
    <p className="weather-temperature">
      {weather.temperature ? `${Math.round(weather.temperature)}°C` : '...'}
    </p>
    <div className="weather-humidity">
      <img
        src={weatherIcons['humidity.png']}  // Icône d'humidité
        alt="Humidity Icon"
        className="weather-icon"
      />
      {weather.humidity ? `${weather.humidity}%` : '...'}
    </div>
    <div className="weather-wind">
      <img
        src={weatherIcons['wind.png']}  // Icône du vent
        alt="Wind Icon"
        className="weather-icon"
      />
      {weather.wind ? `${Math.round(weather.wind)} km/h` : '...'}
    </div>
  </div>
</div>

              <Zone 
                zoneId="right" 
                iconId={zones['right']} 
                moveIcon={moveIcon} 
                handleClick={handleClick} 
              />
            </div>
            <div className="bottom-zones">
              {Array.from({ length: 10 }, (_, i) => (
                <Zone
                  key={`bottom${i + 1}`}
                  zoneId={`bottom${i + 1}`}
                  iconId={zones[`bottom${i + 1}`]}
                  moveIcon={moveIcon}
                  handleClick={handleClick} // Passe la fonction de clic pour toutes les zones
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
