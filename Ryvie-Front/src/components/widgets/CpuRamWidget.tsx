import React, { useState, useEffect, useRef } from 'react';
import axios from '../../utils/setupAxios';
import BaseWidget from './BaseWidget';
import urlsConfig from '../../config/urls';
import '../../styles/widgets/CpuRamWidget.css';
import { useLanguage } from '../../contexts/LanguageContext';

const { getServerUrl } = urlsConfig;

// Cache "dernière valeur connue" (stale-while-revalidate) : on réaffiche immédiatement
// le CPU/RAM du dernier chargement, puis on rafraîchit en arrière-plan. Évite le skeleton
// gris à chaque visite (l'appel /api/server-info peut prendre plusieurs secondes).
const CPURAM_CACHE_KEY = 'ryvie_widget_cpuram_cache';
type CpuRamData = { cpu: number; ram: number; ramTotal: number };
const readCpuRamCache = (): CpuRamData | null => {
  try {
    const raw = localStorage.getItem(CPURAM_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.cpu === 'number' && typeof parsed.ram === 'number') return parsed;
    }
  } catch {}
  return null;
};
const writeCpuRamCache = (d: CpuRamData) => {
  try { localStorage.setItem(CPURAM_CACHE_KEY, JSON.stringify(d)); } catch {}
};

/**
 * Widget affichant l'utilisation CPU et RAM
 */
const CpuRamWidget = ({ id, onRemove, accessMode }: { id: string; onRemove?: () => void; accessMode?: string }) => {
  const { t } = useLanguage();
  const cachedCpuRam = readCpuRamCache();
  const [data, setData] = useState<CpuRamData>(cachedCpuRam || { cpu: 0, ram: 0, ramTotal: 0 });
  const [loading, setLoading] = useState(!cachedCpuRam);
  // Amorcer les valeurs lissées/affichées depuis le cache pour afficher les jauges
  // directement à la bonne valeur (pas d'animation depuis 0 à chaque visite).
  const [smoothed, setSmoothed] = useState({ cpu: cachedCpuRam?.cpu || 0, ram: cachedCpuRam?.ram || 0 });
  const [displayed, setDisplayed] = useState({ cpu: cachedCpuRam?.cpu || 0, ram: cachedCpuRam?.ram || 0 });
  const cpuAnimRef = useRef<number | null>(null);
  const ramAnimRef = useRef<number | null>(null);
  

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        const serverUrl = getServerUrl(accessMode || 'private');
        const response = await axios.get(`${serverUrl}/api/server-info`, {
          timeout: 30000
        });
        
        if (response.data) {
          // Extraire CPU et RAM (peuvent être des strings comme "12.8%" ou des nombres)
          let cpuValue = 0;
          let ramValue = 0;
          let ramTotalValue = 0;
          
          // CPU
          if (typeof response.data.cpu === 'string') {
            const cpuMatch = response.data.cpu.match(/(\d+(\.\d+)?)/);
            if (cpuMatch) cpuValue = parseFloat(cpuMatch[1]);
          } else if (typeof response.data.cpu === 'number') {
            cpuValue = response.data.cpu;
          }
          
          // RAM
          if (typeof response.data.ram === 'string') {
            const ramMatch = response.data.ram.match(/(\d+(\.\d+)?)/);
            if (ramMatch) ramValue = parseFloat(ramMatch[1]);
          } else if (typeof response.data.ram === 'number') {
            ramValue = response.data.ram;
          }
          
          // RAM Total (en bytes)
          if (response.data.ramTotal) {
            ramTotalValue = response.data.ramTotal;
          }
          
          const next = {
            cpu: Math.round(cpuValue),
            ram: Math.round(ramValue),
            ramTotal: ramTotalValue
          };
          setData(next);
          writeCpuRamCache(next);
          setLoading(false);
        }
      } catch (error) {
        console.error('[CpuRamWidget] Erreur lors de la récupération des stats:', error);
        setLoading(false);
      }
    };

    fetchSystemStats();
    const interval = setInterval(fetchSystemStats, 8000); // Mise à jour toutes les 8 secondes

    return () => clearInterval(interval);
  }, [accessMode]);

  // Lissage exponentiel léger, uniquement pour adoucir le mouvement des jauges.
  //
  // L'ancienne « moyenne intelligente » écartait les échantillons éloignés de plus
  // de 30 % de la MÉDIANE, un seuil proportionnel : à 2 % de CPU il ne tolérait
  // que ±0,6 point, et à 0 % il n'acceptait plus que la valeur exacte. Les jauges
  // restaient donc collées au repos alors que la charge montait. Le serveur
  // échantillonne désormais sur une fenêtre fixe de 5 s (cf. systemService), donc
  // il n'y a plus de pic parasite à filtrer.
  useEffect(() => {
    const ALPHA = 0.5; // 0 = figé, 1 = brut. 0.5 : réactif mais sans à-coups.
    setSmoothed((prev) => ({
      cpu: prev.cpu === 0 ? data.cpu : ALPHA * data.cpu + (1 - ALPHA) * prev.cpu,
      ram: prev.ram === 0 ? data.ram : ALPHA * data.ram + (1 - ALPHA) * prev.ram,
    }));
  }, [data.cpu, data.ram]);

  const ANIM_INTERVAL_MS = 50; // animation speed

  // Animate CPU value 1-by-1 toward smoothed target
  useEffect(() => {
    if (cpuAnimRef.current) {
      cancelAnimationFrame(cpuAnimRef.current);
      cpuAnimRef.current = null;
    }
    let current = displayed.cpu;
    const target = Math.round(Math.max(0, Math.min(100, smoothed.cpu)));
    if (current === target) return;
    let last = performance.now();
    const step = (now: number) => {
      if (now - last >= ANIM_INTERVAL_MS) {
        if (current < target) current += 1;
        else if (current > target) current -= 1;
        setDisplayed((prev) => ({ ...prev, cpu: current }));
        last = now;
      }
      if (current !== target) {
        cpuAnimRef.current = requestAnimationFrame(step);
      } else {
        cpuAnimRef.current = null;
      }
    };
    cpuAnimRef.current = requestAnimationFrame(step);
    return () => {
      if (cpuAnimRef.current) {
        cancelAnimationFrame(cpuAnimRef.current);
        cpuAnimRef.current = null;
      }
    };
  }, [smoothed.cpu, displayed.cpu]);

  // Animate RAM value 1-by-1 toward smoothed target
  useEffect(() => {
    if (ramAnimRef.current) {
      cancelAnimationFrame(ramAnimRef.current);
      ramAnimRef.current = null;
    }
    let current = displayed.ram;
    const target = Math.round(Math.max(0, Math.min(100, smoothed.ram)));
    if (current === target) return;
    let last = performance.now();
    const step = (now: number) => {
      if (now - last >= ANIM_INTERVAL_MS) {
        if (current < target) current += 1;
        else if (current > target) current -= 1;
        setDisplayed((prev) => ({ ...prev, ram: current }));
        last = now;
      }
      if (current !== target) {
        ramAnimRef.current = requestAnimationFrame(step);
      } else {
        ramAnimRef.current = null;
      }
    };
    ramAnimRef.current = requestAnimationFrame(step);
    return () => {
      if (ramAnimRef.current) {
        cancelAnimationFrame(ramAnimRef.current);
        ramAnimRef.current = null;
      }
    };
  }, [smoothed.ram, displayed.ram]);

  const CPU_BASE = '#23D780'; // vert
  const RAM_BASE = '#23D780'; // vert
  const DANGER = '#dc3545';

  const getCpuColor = (value: number) => {
    return value > 90 ? DANGER : CPU_BASE;
  };

  const getRamColor = (value: number) => {
    return value > 90 ? DANGER : RAM_BASE;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 GB';
    const gb = bytes / (1024 ** 3);
    return `${gb.toFixed(1)} GB`;
  };

  const usedRam = data.ramTotal > 0 ? (data.ramTotal * (data.ram / 100)) : 0;

  const Gauge = ({ value = 0, color = '#22c55e', label = '', sub = '' }: { value: number; color: string; label: string; sub: string }) => {
    const size = 80;
    const stroke = 10;
    const center = size / 2;
    const r = center - stroke / 2;
    const circumference = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, value));
    const dash = (clamped / 100) * circumference;
    const gap = circumference - dash;

    return (
      <div className="gauge">
        <svg
          className="gauge-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Trail */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={stroke}
          />
          {/* Value arc */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-value">{clamped}</span>
          <span className="gauge-unit">%</span>
        </div>
        <div className="gauge-label">{label}</div>
        <div className="gauge-sub">{sub}</div>
      </div>
    );
  };
  return (
    <BaseWidget 
      id={id} 
      title={t('cpuRamWidget.title')}
      icon="💻" 
      onRemove={onRemove} 
      w={2} 
      h={2}
      className="gradient"
      action={undefined}
    >
      {loading ? (
        <div className="cpu-ram-card">
          <div className="gauges">
            <div className="gauge-skeleton">
              <div className="gauge-circle-skeleton" />
              <div className="gauge-text-skeleton">
                <div className="gauge-value-skeleton" />
                <div className="gauge-label-skeleton" />
              </div>
            </div>
            <div className="gauge-skeleton">
              <div className="gauge-circle-skeleton" />
              <div className="gauge-text-skeleton">
                <div className="gauge-value-skeleton" />
                <div className="gauge-label-skeleton" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="cpu-ram-card">
          <div className="gauges">
            <Gauge
              value={displayed.cpu}
              color={getCpuColor(displayed.cpu)}
              label={t('cpuRamWidget.cpu')}
              sub=""
            />
            <Gauge
              value={displayed.ram}
              color={getRamColor(displayed.ram)}
              label={t('cpuRamWidget.ram')}
              sub=""
            />
          </div>
        </div>
      )}
    </BaseWidget>
  );
};

export default CpuRamWidget;
