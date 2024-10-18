import React, { useState, useEffect } from 'react';
import './Home.css';
import axios from 'axios';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { io } from 'socket.io-client';
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

// Composant pour chaque icône avec son nom affiché sous l'icône (sauf côté gauche)
const Icon = ({ id, src, zoneId, moveIcon, handleClick, showName = true }) => {
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
    <div className="icon-container">
      <div
        ref={ref}
        className="icon"
        style={{
          backgroundImage: `url(${src})`,
          opacity: isDragging ? 0.5 : 1,
          cursor: 'pointer',
        }}
        onClick={() => handleClick(id)}
      ></div>
      {showName && <p className="icon-name">{id.replace('.jpeg', '').replace('.png', '')}</p>}
    </div>
  );
};

// Composant pour chaque zone
const Zone = ({ zoneId, iconId, moveIcon, handleClick, showName }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemTypes.ICON,
    canDrop: () => true,
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
    <div ref={drop} className={`zone ${isActive ? 'zone-active' : ''}`}>
      <div className="icon-container">
        {iconId.length > 0 && (
          <Icon
            id={iconId[0]}
            src={images[iconId[0]]}
            zoneId={zoneId}
            moveIcon={moveIcon}
            handleClick={handleClick}
            showName={showName}
          />
        )}
      </div>
    </div>
  );
};

// Barre des tâches
const Taskbar = ({ handleClick }) => {
  const taskbarIcons = [
    images['AppStore.jpeg'],
    images['Drive.png'],
    images['Cloud.png'],
    images['user.png'],
    images['settings.png'],
  ];

  return (
    <div className="taskbar">
      {taskbarIcons.map((iconSrc, index) => (
        <div
          key={index}
          className="taskbar-circle"
          onClick={() => handleClick(Object.keys(images)[index])}
        >
          <img src={iconSrc} alt={`Icon ${index}`} />
        </div>
      ))}
    </div>
  );
};

// Composant principal
const Home = () => {
  const [zones, setZones] = useState({
    left: ['AppStore.jpeg'],
    right: ['Drive.png'],
    bottom1: ['Cloud.png'],
    bottom2: ['Portainer.png'],
    bottom3: [],
    bottom4: [],
    bottom5: [],
    bottom6: [],
    bottom7: [],
    bottom8: [],
    bottom9: [],
    bottom10: [],
    apps: Object.keys(images).filter(
      (iconId) => !['AppStore.jpeg', 'Drive.png', 'Cloud.png'].includes(iconId)
    ),
  });

  const [weather, setWeather] = useState({
    location: 'Loading...',
    temperature: null,
    description: '',
    icon: 'default.png',
  });

  const [serverStatus, setServerStatus] = useState(false); // Status de la connexion au serveur

  useEffect(() => {
    const socket = io('http://192.168.1.39:3000'); // Remplacer par l'adresse correcte de votre serveur

    socket.on('status', (data) => {
      setServerStatus(data.serverStatus);
    });

    socket.on('disconnect', () => {
      setServerStatus(false);
    });

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    const fetchWeatherData = () => {
      const geoApiUrl = 'http://ip-api.com/json';

      axios.get(geoApiUrl).then((response) => {
        const { city, lat, lon } = response.data;

        const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode,relative_humidity_2m,windspeed_10m&timezone=auto`;

        axios.get(weatherApiUrl).then((weatherResponse) => {
          const data = weatherResponse.data;

          const weatherCode = data.current_weather.weathercode;
          let icon = 'sunny.png';

          if (weatherCode >= 1 && weatherCode <= 3) {
            icon = 'cloudy.png';
          } else if (weatherCode === 61 || weatherCode === 63 || weatherCode === 65) {
            icon = 'rainy.png';
          }

          setWeather({
            location: city,
            temperature: data.current_weather.temperature,
            humidity: data.hourly.relative_humidity_2m[0],
            wind: data.current_weather.windspeed,
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
          wind: null,
          description: '',
          icon: 'default.png',
        });
      });
    };

    fetchWeatherData(); // Appeler la fonction au montage initial

    // Mettre à jour les données toutes les 5 minutes (300000 ms)
    const intervalId = setInterval(fetchWeatherData, 300000);

    return () => clearInterval(intervalId);
  }, []);

  const moveIcon = (id, fromZoneId, toZoneId) => {
    setZones((prevZones) => {
      const fromIcons = prevZones[fromZoneId].filter((iconId) => iconId !== id);
      let toIcons = prevZones[toZoneId];

      if (!toIcons) toIcons = [];

      if (toIcons.length === 0) {
        toIcons = [id];
      } else {
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

  const handleClick = (iconId) => {
    if (iconId === 'Cloud.png') {
      window.open('http://207.180.204.159:8081/app1/', '_blank');
    }
    if (iconId === 'Portainer.png') {
      window.open('http://207.180.204.159:8081/app3/', '_blank');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="home-container">
        <div className="background">
          {/* Indicateur de connexion en haut à gauche */}
          <div className={`server-status ${serverStatus ? 'connected' : 'disconnected'}`}>
            {serverStatus ? 'Connected' : 'Disconnected'}
          </div>

          <Taskbar handleClick={handleClick} />
          <div className="content">
            <h1 className="title">Bienvenue dans votre Cloud</h1>
            <div className="main-content">
              <div className="top-zones">
                <Zone
                  zoneId="left"
                  iconId={zones['left']}
                  moveIcon={moveIcon}
                  handleClick={handleClick}
                />
              </div>
              <div className="widget" style={{ backgroundImage: `url(${weatherImages[weather.icon]})` }}>
                <div className="weather-info">
                  <p className="weather-city">{weather.location ? weather.location : 'Localisation non disponible'}</p>
                  <p className="weather-temperature">{weather.temperature ? `${Math.round(weather.temperature)}°C` : '...'}</p>
                  <div className="weather-humidity">
                    <img src={weatherIcons['humidity.png']} alt="Humidity Icon" className="weather-icon" />
                    {weather.humidity ? `${weather.humidity}%` : '...'}
                  </div>
                  <div className="weather-wind">
                    <img src={weatherIcons['wind.png']} alt="Wind Icon" className="weather-icon" />
                    {weather.wind ? `${Math.round(weather.wind)} km/h` : '...'}
                  </div>
                </div>
              </div>
              <div className="top-zones">
                <Zone
                  zoneId="right"
                  iconId={zones['right']}
                  moveIcon={moveIcon}
                  handleClick={handleClick}
                  className="zone-right"
                />
              </div>
            </div>
            <div className="bottom-zones">
              {Array.from({ length: 10 }, (_, i) => (
                <Zone
                  key={`bottom${i + 1}`}
                  zoneId={`bottom${i + 1}`}
                  iconId={zones[`bottom${i + 1}`]}
                  moveIcon={moveIcon}
                  handleClick={handleClick}
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
