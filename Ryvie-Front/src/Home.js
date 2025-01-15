import React, { useState, useEffect } from 'react';
import './styles/Home.css';
import './styles/Transitions.css';
import axios from 'axios';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { io } from 'socket.io-client';
import { Link } from 'react-router-dom';

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
const exceptions = ['AppStore.png','settings.png','user.png'];



// Types pour react-dnd
const ItemTypes = {
  ICON: 'icon',
};

// Composant pour chaque icône
const Icon = ({ id, src, zoneId, moveIcon, handleClick, showName = true, isActive }) => {
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
          position: 'relative',
        }}
        onClick={() => handleClick(id)}
      >
        {id.endsWith('.png') && !exceptions.includes(id) ? (
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
        ) : null}
      </div>
      {showName && <p className="icon-name">{id.replace('.jpeg', '').replace('.png', '')}</p>}
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

const Taskbar = ({ handleClick }) => {
  const taskbarIcons = [
    images['AppStore.jpeg'],
    images['Drive.png'],
    images['rCloud.png'],
    images['user.png'],
    images['settings.png'],
  ];

  return (
    <div className="taskbar">
      {taskbarIcons.map((iconSrc, index) => (
        <div key={index} className="taskbar-circle">
          {index === 2 ? (
            <Link to="/login">
              <img src={iconSrc} alt={`Icon ${index}`} />
            </Link>
          ) : index === 3 ? (
            <Link to="/user">
              <img src={iconSrc} alt={`Icon ${index}`} />
            </Link>
          ) : index === 4 ? (
            <Link to="/settings">
              <img src={iconSrc} alt={`Icon ${index}`} />
            </Link>
          ) : (
            <div onClick={() => handleClick(Object.keys(images)[index])}>
              <img src={iconSrc} alt={`Icon ${index}`} />
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
  const [zones, setZones] = useState({
    left: ['AppStore.jpeg'],
    right: ['Drive.png'],
    bottom1: ['rCloud.png'],
    bottom2: ['Portainer.png'],
    bottom3: ['Outline.png'],
    bottom4: ['rTransfer.png'],
    bottom5: ['rDrop.png'],
    bottom6: [],
    bottom7: [],
    bottom8: [],
    bottom9: [],
    bottom10: [],
    apps: Object.keys(images).filter(
      (iconId) => !['AppStore.jpeg', 'Drive.png', 'Cloud.png', 'Outline.png','rTransfer.png'].includes(iconId)
    ),
  });

  const appUrls = {
    'AppStore.jpeg': accessMode === 'public' ? 'https://user1.appstore.ryvie.fr' : 'http://192.168.1.34:3000',
    'rCloud.png': accessMode === 'public' ? 'https://user1.rcloud.ryvie.fr' : 'http://192.168.1.34:8080',
    'Portainer.png': accessMode === 'public' ? 'https://user1.portainer.ryvie.fr' : 'http://192.168.1.34:9000',
    'Outline.png': 'https://192.168.1.34:8443/', 
    'rTransfer.png': accessMode === 'public' ? 'https://user1.rtransfer.ryvie.fr/auth/signIn' : 'http://192.168.1.34:3002',
    'rDrop.png': accessMode === 'public' ? 'https://user1.rdrop.ryvie.fr' : 'http://ryvie.local:8081',
  };
  
  const [weather, setWeather] = useState({
    location: 'Loading...',
    temperature: null,
    description: '',
    icon: 'default.png',
  });

  const [serverStatus, setServerStatus] = useState(false);
  const [appStatus, setAppStatus] = useState({
    'rCloud.png': false,
    'Portainer.png': false,
    'Outline.png': false,
    'rTransfer.png': false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const socket = io('http://ryvie.local:3001'); // Adresse de votre serveur

    socket.on('status', (data) => {
      setServerStatus(data.serverStatus);
      if (data.serverStatus) {
        console.log('Connected to server');
      }
    });

    socket.on('containers', (data) => {
      console.log('Conteneurs actifs:', data.activeContainers);

      const isCloudRunning = data.activeContainers.includes('Cloud');
      const isPortainerRunning = data.activeContainers.includes('Portainer');
      const isOutlineRunning = data.activeContainers.includes('outline');
      const isrTransferRunning = data.activeContainers.includes('pingvin-share-pingvin-share-1');
      const isDropRunning = data.activeContainers.includes('snapdrop-nginx-1');

      setAppStatus((prevStatus) => ({
        ...prevStatus,
        'rCloud.png': isCloudRunning,
        'Portainer.png': isPortainerRunning,
        'Outline.png': isOutlineRunning,
        'rTransfer.png': isrTransferRunning,
        'rDrop.png': isDropRunning,
      }));
    });

    socket.on('disconnect', () => {
      setServerStatus(false);
    });

    return () => socket.disconnect();
  }, []);

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

      return {
        ...prevZones,
        [fromZoneId]: fromIcons,
        [toZoneId]: toIcons,
      };
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
    if (iconId === 'rCloud.png') {
      openAppWindow(appUrls[iconId], false);
      return;
    }
    if (iconId === 'rTransfer.png') {
      openAppWindow(appUrls[iconId], false);
      return;
    }

    if (appUrls[iconId]) {
      openAppWindow(appUrls[iconId], true);
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
