const { execFile, spawn } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

// Mot de passe livré avec l'image Ryvie OS. Tant qu'il n'a pas été changé,
// l'accès SSH équivaut à un accès root (l'utilisateur applicatif a sudo NOPASSWD).
const DEFAULT_PASSWORD = 'ryvie';
const MIN_PASSWORD_LENGTH = 10;

function appUser(): string {
  return process.env.RYVIE_USER || 'ryvie';
}

// Vérifie un mot de passe candidat contre /etc/shadow en re-hachant avec le sel
// stocké (crypt(3) de libxcrypt, via ctypes : le module `crypt` de Python a été
// retiré en 3.13 et `openssl passwd` ne gère pas yescrypt, l'algorithme par
// défaut de Debian 13). N'ÉCRIT JAMAIS le hash sur stdout : uniquement un verdict.
const CHECK_SCRIPT = `
import sys, ctypes, ctypes.util
user, candidate = sys.argv[1], sys.argv[2]
h = None
with open('/etc/shadow') as f:
    for line in f:
        p = line.split(':')
        if p[0] == user:
            h = p[1]
            break
if not h or h[0] in '!*' or h == '':
    print('nopassword'); sys.exit(0)
lib = ctypes.CDLL(ctypes.util.find_library('crypt'))
lib.crypt.restype = ctypes.c_char_p
lib.crypt.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
out = lib.crypt(candidate.encode(), h.encode())
print('match' if out is not None and out.decode() == h else 'nomatch')
`;

/** 'match' | 'nomatch' | 'nopassword' | null si la vérification a échoué. */
async function checkPassword(user: string, candidate: string): Promise<string | null> {
  try {
    // Arguments passés en tableau (jamais via un shell) : le mot de passe candidat
    // ne transite pas par une ligne de commande interprétée.
    const { stdout } = await execFilePromise(
      'sudo',
      ['python3', '-c', CHECK_SCRIPT, user, candidate],
      { timeout: 10000 }
    );
    return stdout.trim();
  } catch (_) {
    return null;
  }
}

/**
 * État du compte système : le mot de passe par défaut est-il toujours en place ?
 * `usingDefaultPassword` vaut null si la vérification n'a pas pu aboutir — l'UI
 * n'affiche alors aucune affirmation plutôt qu'une fausse assurance.
 */
async function getAccountStatus() {
  const user = appUser();
  const verdict = await checkPassword(user, DEFAULT_PASSWORD);

  return {
    user,
    usingDefaultPassword: verdict === null ? null : verdict === 'match',
    passwordSet: verdict === null ? null : verdict !== 'nopassword',
    minPasswordLength: MIN_PASSWORD_LENGTH,
  };
}

/**
 * Change le mot de passe du compte système applicatif.
 *
 * Le secret est écrit sur l'entrée standard de chpasswd, jamais dans la ligne de
 * commande : il n'apparaît donc ni dans `ps` ni dans l'historique du shell.
 */
function setSystemPassword(newPassword: string): Promise<void> {
  const user = appUser();
  return new Promise((resolve, reject) => {
    const child = spawn('sudo', ['chpasswd'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: any) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `chpasswd a échoué (code ${code})`));
    });
    child.stdin.write(`${user}:${newPassword}\n`);
    child.stdin.end();
  });
}

/** Renvoie un message d'erreur, ou null si le mot de passe est acceptable. */
function validatePassword(newPassword: any): string | null {
  if (typeof newPassword !== 'string' || newPassword.length === 0) {
    return 'Le mot de passe est requis.';
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (newPassword === DEFAULT_PASSWORD || newPassword === appUser()) {
    return 'Ce mot de passe est le mot de passe par défaut. Choisissez-en un autre.';
  }
  // Un retour à la ligne couperait l'entrée de chpasswd et pourrait injecter une
  // seconde ligne "user:password".
  if (/[\n\r:]/.test(newPassword)) {
    return 'Le mot de passe ne peut pas contenir de retour à la ligne ni le caractère « : ».';
  }
  return null;
}

export = { getAccountStatus, setSystemPassword, validatePassword, MIN_PASSWORD_LENGTH };
