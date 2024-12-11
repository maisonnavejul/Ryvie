import React, { useState, useEffect } from 'react';
import './Home.css';
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

// URLs pour chaque icône
const appUrls = {
  'AppStore.jpeg': 'https://user1.appstore.ryvie.fr',
  'rCloud.png': 'https://user1.rcloud.ryvie.fr',
  'Portainer.png': 'https://user1.portainer.ryvie.fr',
  'Outline.png': 'https://192.168.1.34:8443/',
  'rTransfer.png': 'https://user1.rtransfer.ryvie.fr',
};

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
          {index === 3 ? (
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
  const [zones, setZones] = useState({
    left: ['AppStore.jpeg'],
    right: ['Drive.png'],
    bottom1: ['rCloud.png'],
    bottom2: ['Portainer.png'],
    bottom3: ['Outline.png'],
    bottom4: ['rTransfer.png'],
    bottom5: [],
    bottom6: [],
    bottom7: [],
    bottom8: [],
    bottom9: [],
    bottom10: [],
    apps: Object.keys(images).filter(
      (iconId) => !['AppStore.jpeg', 'Drive.png', 'Cloud.png', 'Outline.png','rTransfer.png'].includes(iconId)
    ),
  });

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

  useEffect(() => {
    const socket = io('http://192.168.1.34:3001'); // Adresse de votre serveur

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

      setAppStatus((prevStatus) => ({
        ...prevStatus,
        'rCloud.png': isCloudRunning,
        'Portainer.png': isPortainerRunning,
        'Outline.png': isOutlineRunning,
        'rTransfer.png': isrTransferRunning,
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

  // Fonction générique pour ouvrir la nouvelle fenêtre avec overlay et transition
 const openAppWindow = (url) => {
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(`
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              overflow: hidden;
              position: relative;
            }
            .overlay {
              position: absolute;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              background-color: rgba(0,0,0,0.7);
              color: white;
              z-index: 9999;
              opacity: 1;
              transition: opacity 0.5s ease;
            }
            .overlay.hidden {
              opacity: 0;
              pointer-events: none; 
            }
            .loading-spinner {
              width: 50px;
              height: 50px;
              border: 5px solid rgba(255, 255, 255, 0.3);
              border-top-color: #fff;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 10px;
            }
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
            iframe {
              width: 100vw;
              height: 100vh;
              border: none;
            }
          </style>
        </head>
        <body>
          <div class="overlay">
            <div class="loading-spinner"></div>
            <p>Chargement en cours...</p>
          </div>
          <iframe src="${url}"></iframe>
          <script>
            const iframe = document.querySelector('iframe');
            const overlay = document.querySelector('.overlay');

            let loaded = false;
            // Si après 2s pas de load => page bloquée, on redirige
            const timeout = setTimeout(() => {
              if (!loaded) {
                window.location.href = "${url}";
              }
            }, 2000);

            iframe.addEventListener('load', () => {
              loaded = true;
              clearTimeout(timeout);
              overlay.classList.add('hidden');
            });
          </script>
        </body>
      </html>
    `);
    newWindow.document.close();
  }
};

  
  

const handleClick = (iconId) => {
  // Vérifier si l'icône correspond à rCloud
  if (iconId === 'rCloud.png') {
    // Ouvre directement le lien sans passer par l'iframe
    window.open(appUrls[iconId], '_blank');
    return;
  }

  // Pour les autres icônes
  if (appUrls[iconId]) {
    // Ouvrir la fenêtre avec overlay et iframe
    openAppWindow(appUrls[iconId]);
  } else {
    console.log("Pas d'URL trouvée pour cette icône :", iconId);
  }
};


  return (
    <DndProvider backend={HTML5Backend}>
      <div className="home-container">
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
      </div>
    </DndProvider>
  );
};

export default Home;
