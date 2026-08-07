const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const execPromise = util.promisify(exec);

// Unités possibles selon la distro : Debian/Ubuntu classique utilise ssh.service,
// mais depuis Ubuntu 22.10 / Debian 13 l'activation par socket (ssh.socket) existe
// aussi. On agit sur les DEUX, sinon couper ssh.service laisse le socket relancer
// sshd à la première connexion et l'interrupteur n'a aucun effet.
const SSH_UNITS = ['ssh.service', 'ssh.socket'];

// `systemctl` renvoie un code de sortie non nul pour des états parfaitement
// normaux (`disabled`, `inactive`, unité absente). On veut la sortie texte, pas
// une exception : d'où ce helper qui ne rejette jamais.
async function systemctlQuery(verb: string, unit: string): Promise<string> {
  try {
    const { stdout } = await execPromise(`systemctl ${verb} ${unit}`, { timeout: 5000 });
    return stdout.trim();
  } catch (error: any) {
    // stdout porte l'état même quand le code de sortie est non nul.
    return (error?.stdout || '').trim() || 'unknown';
  }
}

/** Cherche un authorized_keys non vide pour un utilisateur donné. */
function hasAuthorizedKeys(home: string): boolean {
  try {
    const keyFile = path.join(home, '.ssh', 'authorized_keys');
    if (!fs.existsSync(keyFile)) return false;
    return fs
      .readFileSync(keyFile, 'utf8')
      .split('\n')
      .some((line: string) => line.trim() && !line.trim().startsWith('#'));
  } catch (_) {
    return false;
  }
}

/**
 * Renvoie l'état SSH complet.
 *
 * `enabled` reflète la persistance au reboot (systemctl is-enabled), `active`
 * l'état courant. Les deux sont distincts : on peut avoir un sshd actif mais
 * désactivé au démarrage (ou l'inverse via le socket).
 */
async function getSshStatus() {
  const units: Record<string, { enabled: string; active: string }> = {};
  for (const unit of SSH_UNITS) {
    const [enabled, active] = await Promise.all([
      systemctlQuery('is-enabled', unit),
      systemctlQuery('is-active', unit),
    ]);
    units[unit] = { enabled, active };
  }

  const values = Object.values(units);
  const enabled = values.some(u => u.enabled === 'enabled');
  const active = values.some(u => u.active === 'active' || u.active === 'listening');
  const masked = values.some(u => u.enabled === 'masked');

  // Contexte de sécurité : l'auth par mot de passe est le vrai facteur de risque
  // (l'utilisateur applicatif a sudo NOPASSWD → mot de passe SSH = root).
  let passwordAuth: boolean | null = null;
  let port: number | null = null;
  try {
    const { stdout } = await execPromise('sudo sshd -T 2>/dev/null', { timeout: 5000 });
    const pwMatch = stdout.match(/^passwordauthentication\s+(\S+)/mi);
    if (pwMatch) passwordAuth = pwMatch[1].toLowerCase() === 'yes';
    const portMatch = stdout.match(/^port\s+(\d+)/mi);
    if (portMatch) port = parseInt(portMatch[1], 10);
  } catch (_) {
    // sshd absent ou config illisible : on laisse null (l'UI n'affiche pas l'avertissement).
  }

  // Un utilisateur qui coupe SSH sans clé déposée n'a plus AUCUN accès distant
  // shell : l'UI doit le dire avant de basculer l'interrupteur.
  const appUser = process.env.RYVIE_USER || 'ryvie';
  const keysPresent = hasAuthorizedKeys(`/home/${appUser}`) || hasAuthorizedKeys('/root');

  return { enabled, active, masked, units, passwordAuth, port, hasAuthorizedKeys: keysPresent };
}

/**
 * Active ou désactive SSH, de façon persistante au reboot.
 *
 * À l'extinction on masque en plus les unités : sans masquage, une mise à jour du
 * paquet openssh-server réactive le service et l'interrupteur « off » de l'UI
 * mentirait silencieusement. `stop` ne coupe pas les sessions SSH déjà ouvertes
 * (ssh.service est en KillMode=process), donc on ne se déconnecte pas soi-même.
 */
async function setSshEnabled(enabled: boolean) {
  if (enabled) {
    await execPromise(`sudo systemctl unmask ${SSH_UNITS.join(' ')}`, { timeout: 15000 }).catch(() => {});
    // Seul ssh.service est démarré : réactiver aussi ssh.socket ferait un conflit
    // de port 22 entre les deux unités.
    await execPromise('sudo systemctl enable --now ssh.service', { timeout: 30000 });
  } else {
    await execPromise(`sudo systemctl disable --now ${SSH_UNITS.join(' ')}`, { timeout: 30000 }).catch(() => {});
    await execPromise(`sudo systemctl mask ${SSH_UNITS.join(' ')}`, { timeout: 15000 });
  }
  return getSshStatus();
}

export = { getSshStatus, setSshEnabled };
