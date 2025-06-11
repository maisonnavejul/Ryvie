import React, { useState, useEffect } from 'react';
import './styles/Home.css';
import './styles/Transitions.css';
import axios from 'axios';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { io } from 'socket.io-client';
import { Link, useNavigate } from 'react-router-dom';
const { getServerUrl, getAppUrl } = require('./config/urls');

// Fonction pour importer toutes les images du dossier icons
const importAll = (r) => {
  let images = {};
  r.keys().forEach((item) => {
    images[item.replace('./', '')] = r(item);
  });
  return images;
};

const images = importAll(require.context('./icons', false, /\.(png|jpe?g|svg)$/));
const weatherImages = importAll(require.context('./weather_icons', false, /\.(png|jpe?g|svg)$/));
const weatherIcons = importAll(require.context('./weather_icons', false, /\.(png|jpe?g|svg)$/));

// Configuration centralisée des applications
const APPS_CONFIG = {
  'AppStore.jpeg': {
    name: 'AppStore',
    urlKey: 'APP_STORE',
    showStatus: false,
    isTaskbarApp: true,
  },
  'rCloud.png': {
    name: 'rCloud',
    urlKey: 'RCLOUD',
    showStatus: true,
    isTaskbarApp: false,
    containerName: 'app-rcloud',
  },
  'Drive.png': {
    name: 'Drive',
    urlKey: 'DRIVE',
    showStatus: false,
    isTaskbarApp: false,
  },
  'Portainer.png': {
    name: 'Portainer',
    urlKey: 'PORTAINER',
    showStatus: true,
    isTaskbarApp: false,
    containerName: 'app-portainer',
  },
  'Outline.png': {
    name: 'Outline',
    urlKey: 'OUTLINE',
    showStatus: true,
    isTaskbarApp: false,
    containerName: 'outline',
  },
  'rTransfer.png': {
    name: 'rTransfer',
    urlKey: 'RTRANSFER',
    showStatus: true,
    isTaskbarApp: false,
    containerName: 'app-rtransfer',
    useDirectWindow: true,
  },
  'rDrop.png': {
    name: 'rDrop',
    urlKey: 'RDROP',
    showStatus: true,
    isTaskbarApp: false,
    containerName: 'app-rdrop-nginx',
  },
  'rPictures.svg': {
    name: 'rPictures',
    urlKey: 'RPictures',
    showStatus: true,
    isTaskbarApp: false,
    containerName: 'app-rpictures-server',
  },
  'user.svg': {
    name: 'User',
    urlKey: '',
    showStatus: false,
    isTaskbarApp: true,
    route: '/user',
  },
  'transfer.svg': {
    name: 'Transfer',
    urlKey: '',
    showStatus: false,
    isTaskbarApp: true,
    route: '/userlogin',
  },
    'settings.svg': {
    name: 'Settings',
    urlKey: '',
    showStatus: false,
    isTaskbarApp: true,
    route: '/settings',
  },
};

// Types pour react-dnd
const ItemTypes = {
  ICON: 'icon',
};

// Composant pour chaque icône
const Icon = ({ id, src, zoneId, moveIcon, handleClick, showName = true, isActive }) => {
  const ref = React.useRef(null);
  const appConfig = APPS_CONFIG[id] || {};

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
          position: 'relative',
        }}
        onClick={() => handleClick(id)}
      >
        {appConfig.showStatus && (
          <div
            className="status-badge"
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: isActive ? 'green' : 'red',
              border: '2px solid white',
            }}
          ></div>
        )}
      </div>
      {showName && <p className="icon-name">{appConfig.name || id.replace('.jpeg', '').replace('.png', '').replace('.svg', '')}</p>}
    </div>
  );
};

// Composant Zone
const Zone = ({ zoneId, iconId, moveIcon, handleClick, showName, appStatus }) => {
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
            isActive={appStatus[iconId[0]]}
          />
        )}
      </div>
    </div>
  );
};

// Composant Taskbar
const Taskbar = ({ handleClick }) => {
  // Filtrer les icônes de la barre des tâches à partir de la configuration
  const taskbarApps = Object.entries(APPS_CONFIG)
    .filter(([_, config]) => config.isTaskbarApp)
    .map(([iconId, config]) => ({ iconId, config }));

  return (
    <div className="taskbar">
      {taskbarApps.map(({ iconId, config }, index) => (
        <div key={index} className="taskbar-circle">
          {config.route ? (
            <Link to={config.route}>
              <img src={images[iconId]} alt={config.name} />
            </Link>
          ) : (
            <div onClick={() => handleClick(iconId)}>
              <img src={images[iconId]} alt={config.name} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Composant principal
const Home = () => {
  const [accessMode, setAccessMode] = useState('private'); 
  const [zones, setZones] = useState(() => {
    // Essayer de récupérer les zones depuis localStorage
    const savedZones = localStorage.getItem('iconZones');
    if (savedZones) {
      try {
        return JSON.parse(savedZones);
      } catch (error) {
        console.error('Erreur lors de la récupération des zones:', error);
      }
    }
    
    // Valeurs par défaut si rien n'est trouvé dans localStorage
    return {
      left: ['AppStore.jpeg'],
      right: ['Portainer.png'],
      bottom1: ['rPictures.svg'],
      bottom2: ['rCloud.png'],
      bottom3: ['Outline.png'],
      bottom4: ['rTransfer.png'],
      bottom5: ['rDrop.png'],
      bottom6: [],
      bottom7: [],
      bottom8: [],
      bottom9: [],
      bottom10: [],
    };
  });

  const [weather, setWeather] = useState({
    location: 'Loading...',
    temperature: null,
    description: '',
    icon: 'default.png',
  });

  const [serverStatus, setServerStatus] = useState(false);
  const [appStatus, setAppStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const storedMode = localStorage.getItem('accessMode') || 'private';
    setAccessMode(storedMode);
  }, []);
  
  useEffect(() => {
    // Récupère la valeur de accessMode depuis le localStorage
    const storedMode = localStorage.getItem('accessMode') || 'private';
    setAccessMode(storedMode); // Met à jour l'état accessMode
  
    const serverUrl = getServerUrl(storedMode);
    console.log("Connexion à :", serverUrl);
  
    const socket = io(serverUrl);
  
    socket.on('status', (data) => {
      setServerStatus(data.serverStatus);
      if (data.serverStatus) {
        console.log('Connected to server');
      }
    });
  
    socket.on('containers', (data) => {
      console.log('Conteneurs actifs:', data.activeContainers);
  
      // Mettre à jour le statut des applications en fonction des conteneurs actifs
      const newAppStatus = {};
      
      // Parcourir toutes les applications configurées
      Object.entries(APPS_CONFIG).forEach(([appId, config]) => {
        if (config.showStatus && config.containerName) {
          // Vérifier si le conteneur associé à cette application est actif
          newAppStatus[appId] = data.activeContainers.includes(config.containerName);
        }
      });
      
      setAppStatus(newAppStatus);
    });
  
    socket.on('disconnect', () => {
      setServerStatus(false);
    });
  
    return () => socket.disconnect();
  }, [accessMode]); //  Ajoute accessMode ici pour réexécuter le useEffect à chaque changement
  
  useEffect(() => {
    const fetchWeatherData = () => {
      const geoApiUrl = 'http://ip-api.com/json';

      axios
        .get(geoApiUrl)
        .then((response) => {
          const { city, lat, lon } = response.data;
          const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode,relative_humidity_2m,windspeed_10m&timezone=auto`;

          axios.get(weatherApiUrl).then((weatherResponse) => {
            const data = weatherResponse.data;
            const weatherCode = data.current_weather.weathercode;
            let icon = 'sunny.png';

            if (weatherCode >= 1 && weatherCode <= 3) {
              icon = 'cloudy.png';
            } else if ([61,63,65].includes(weatherCode)) {
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
        })
        .catch((error) => {
          console.error('Erreur lors de la récupération de la localisation', error);
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

    fetchWeatherData();
    const intervalId = setInterval(fetchWeatherData, 300000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const mode = localStorage.getItem('accessMode') || 'private';
    setAccessMode(mode);
  }, []);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
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

      const newZones = {
        ...prevZones,
        [fromZoneId]: fromIcons,
        [toZoneId]: toIcons,
      };
      
      // Sauvegarder les zones dans localStorage après chaque modification
      localStorage.setItem('iconZones', JSON.stringify(newZones));
      
      return newZones;
    });
  };

  const openAppWindow = (url, useOverlay = true) => {
    if (!useOverlay) {
      window.open(url, '_blank', 'width=1000,height=700');
      return;
    } else {
      window.open(url, '_blank', 'width=1000,height=700');
    }
  };

  const handleClick = (iconId) => {
    const appConfig = APPS_CONFIG[iconId];
    
    if (!appConfig || !appConfig.urlKey) {
      console.log("Pas de configuration trouvée pour cette icône :", iconId);
      return;
    }
    
    const appUrl = getAppUrl(appConfig.urlKey, accessMode);
    
    if (appUrl) {
      openAppWindow(appUrl, !appConfig.useDirectWindow);
    } else {
      console.log("Pas d'URL trouvée pour cette icône :", iconId);
    }
  };

  return (
    <div className={`home-container ${mounted ? 'slide-enter-active' : 'slide-enter'}`}>
      <DndProvider backend={HTML5Backend}>
        <div className="background">
          <div className={`server-status ${serverStatus ? 'connected' : 'disconnected'}`}>
            {serverStatus ? 'Connected' : 'Disconnected'}
          </div>

          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}

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
                  appStatus={appStatus}
                />
              </div>
              <div className="widget" style={{ backgroundImage: `url(${weatherImages[weather.icon]})` }}>
                <div className="weather-info">
                  <p className="weather-city">{weather.location ? weather.location : 'Localisation non disponible'}</p>
                  <p className="weather-temperature">
                    {weather.temperature ? `${Math.round(weather.temperature)}°C` : '...'}
                  </p>
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
                  appStatus={appStatus}
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
                  appStatus={appStatus}
                />
              ))}
            </div>
          </div>
        </div>
      </DndProvider>
    </div>
  );
};

export default Home;
