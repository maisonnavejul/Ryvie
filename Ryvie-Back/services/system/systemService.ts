const os = require('os');
const si = require('systeminformation');
const osutils = require('os-utils');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Cache pour getServerInfo (10 secondes)
let serverInfoCache: any = null;
let serverInfoCacheTime = 0;
const CACHE_DURATION = 10000; // 10 secondes

// Métriques temps réel (CPU + RAM), modèle CasaOS : UN SEUL échantillonneur
// périodique côté serveur, et les requêtes HTTP se contentent de LIRE le dernier
// échantillon.
//
// Pourquoi c'est indispensable : si.currentLoad() (comme cpu.Percent(0) de
// gopsutil) renvoie la charge moyenne DEPUIS SON APPEL PRÉCÉDENT, via un compteur
// global au processus. Le calculer dans le handler HTTP le rendait donc dépendant
// du trafic : Settings (5 s), CpuRamWidget (8 s) et StorageWidget (30 s) tapent
// tous /api/server-info, multipliés par le nombre d'onglets et d'utilisateurs.
// Deux appels rapprochés ⇒ fenêtre de mesure de quelques millisecondes ⇒ valeur
// aberrante (0 % ou 100 %). Le ticker fixe garantit une fenêtre régulière.
const SAMPLE_INTERVAL_MS = 5000; // identique au cron "@every 5s" de CasaOS

let liveMetrics = { cpu: '0.0%', ram: '0.0%', ramTotal: 0, ramUsed: 0 };

async function sampleLiveMetrics() {
  // RAM : basée sur la mémoire DISPONIBLE (exclut le cache/buffers réclamables),
  // comme `free`/htop — sinon on affiche ~100 % à cause du cache disque Linux.
  // C'est aussi la formule de gopsutil (Used = Total - Available), donc identique
  // à ce qu'affiche CasaOS.
  let ramTotal = 0;
  let ramUsed = 0;
  try {
    const m = await si.mem();
    const avail = (m.available != null ? m.available : m.free);
    ramTotal = m.total;
    ramUsed = m.total - avail;
  } catch (_) {
    ramTotal = os.totalmem();
    ramUsed = os.totalmem() - os.freemem();
  }
  const ramUsagePercentage = ramTotal > 0 ? ((ramUsed / ramTotal) * 100).toFixed(1) : '0.0';

  let cpuUsagePercentage: string;
  try {
    const load = await si.currentLoad();
    cpuUsagePercentage = Number(load.currentLoad).toFixed(1);
  } catch (_) {
    cpuUsagePercentage = await new Promise(resolve => {
      osutils.cpuUsage(u => resolve((u * 100).toFixed(1)));
    });
  }

  liveMetrics = {
    cpu: `${cpuUsagePercentage}%`,
    ram: `${ramUsagePercentage}%`,
    ramTotal,
    ramUsed,
  };
}

// Premier échantillon lancé au chargement du module, puis ticker régulier.
// unref() : ce timer ne doit pas empêcher le processus de se terminer.
let hasSample = false;
const firstSample = sampleLiveMetrics().then(() => { hasSample = true; }).catch(() => { hasSample = true; });
const sampler = setInterval(() => { sampleLiveMetrics().catch(() => {}); }, SAMPLE_INTERVAL_MS);
if (typeof sampler.unref === 'function') sampler.unref();

async function computeLiveMetrics() {
  // Une requête arrivant avant la fin du tout premier échantillon doit l'attendre,
  // sinon elle renverrait 0 % / 0 octet au lieu de valeurs réelles.
  if (!hasSample) await firstSample;
  return liveMetrics;
}

async function getServerInfo() {
  const now = Date.now();

  // CPU + RAM : lecture du dernier échantillon du ticker (rafraîchi toutes les
  // 5 s indépendamment du trafic HTTP), jamais du cache 10 s ci-dessous.
  const live = await computeLiveMetrics();

  // Le reste (disque, apps, utilisateurs, RAID) est coûteux → cache 10 s.
  if (serverInfoCache && (now - serverInfoCacheTime) < CACHE_DURATION) {
    return { ...serverInfoCache, ...live };
  }

  const diskLayout = await si.diskLayout();
  const fsSizes = await si.fsSize();

  // Compter le nombre d'utilisateurs dans LDAP
  let activeUsersCount = 0;
  try {
    const { listUsersPublic } = require('../auth/ldapService');
    const ldapUsers = await listUsersPublic();
    activeUsersCount = ldapUsers.length;
  } catch (error) {
    console.log('[systemService] Impossible de compter les utilisateurs LDAP:', error);
  }

  // Compter le nombre d'apps installées
  let appsCount = 0;
  try {
    const { listInstalledApps } = require('../apps/appManagerService');
    const installedApps = await listInstalledApps();
    appsCount = installedApps.length;
  } catch (error) {
    console.log('[systemService] Impossible de compter les apps:', error);
  }

  // Vérifier le statut RAID
  let raidStatus = 'inactif';
  try {
    const { stdout } = await execPromise('cat /proc/mdstat 2>/dev/null || echo ""', { timeout: 5000 });
    if (stdout && stdout.includes('active')) {
      raidStatus = 'actif';
    }
  } catch (error) {
    console.log('[systemService] Impossible de vérifier le statut RAID');
  }

  // Trouver la partition racine (/) et /data
  const rootPartition = fsSizes.find(f => f.mount === '/');
  const dataPartition = fsSizes.find(f => f.mount === '/data');
  
  let totalSize = 0;
  let totalUsed = 0;
  let totalFree = 0;

  if (rootPartition) {
    // Total = taille partition système (/) + taille partition /data
    totalSize = rootPartition.size / 1e9;
    if (dataPartition) {
      totalSize += dataPartition.size / 1e9;
    }
    
    // Utilisé = taille partition système + espace utilisé dans /data
    let systemPartitionSize = rootPartition.size / 1e9;
    totalUsed = systemPartitionSize;
    
    // Ajouter l'espace utilisé dans /data (utiliser dataPartition.used qui est cohérent)
    if (dataPartition) {
      const dataUsedGB = dataPartition.used / 1e9;
      totalUsed += dataUsedGB;
      console.log(`[systemService] Système: ${systemPartitionSize.toFixed(1)} GB, /data utilisé: ${dataUsedGB.toFixed(1)} GB, Total: ${totalUsed.toFixed(1)} GB`);
    }
    
    totalFree = totalSize - totalUsed;
  }

  // Informations détaillées sur tous les disques
  const disks = diskLayout.map(d => {
    const totalBytes = d.size;
    const parts = fsSizes.filter(f => f.fs && f.fs.startsWith(d.device));
    const mounted = parts.length > 0;
    const usedBytes = mounted ? parts.reduce((sum, p) => sum + p.used, 0) : 0;
    const freeBytes = mounted ? (totalBytes - usedBytes) : 0;

    return {
      device: d.device,
      size: `${(totalBytes / 1e9).toFixed(1)} GB`,
      used: `${(usedBytes / 1e9).toFixed(1)} GB`,
      free: `${(freeBytes / 1e9).toFixed(1)} GB`,
      mounted,
    };
  });

  const result = {
    stockage: {
      utilise: `${totalUsed.toFixed(1)} GB`,
      libre: `${totalFree.toFixed(1)} GB`,
      total: `${totalSize.toFixed(1)} GB`,
    },
    disques: disks,
    ...live,
    activeUsers: activeUsersCount,
    totalApps: appsCount,
    raidDuplication: raidStatus,
  };
  
  // Mettre en cache le résultat
  serverInfoCache = result;
  serverInfoCacheTime = Date.now();
  
  return result;
}

async function restartServer() {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    console.log('[systemService] Redémarrage du système demandé');
    
    // Redémarrer le système complet après un délai de 5 secondes
    // Cela permet au serveur de répondre correctement à la requête HTTP
    // et de s'assurer que la réponse est bien envoyée au client
    // avant que le système ne commence à s'arrêter
    setTimeout(async () => {
      try {
        console.log('[systemService] Exécution de sudo reboot...');
        await execPromise('sudo reboot');
      } catch (error: any) {
        console.error('[systemService] Erreur lors du reboot:', error);
      }
    }, 5000);
    
    return { success: true, message: 'Le serveur va redémarrer dans 5 secondes...' };
  } catch (error: any) {
    console.error('[systemService] Erreur lors du redémarrage:', error);
    throw error;
  }
}

export = { getServerInfo, restartServer };
