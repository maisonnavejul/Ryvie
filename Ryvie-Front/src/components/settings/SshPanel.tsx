import React from 'react';
import axios from '../../utils/setupAxios';
import urlsConfig from '../../config/urls';
import { useLanguage } from '../../contexts/LanguageContext';

const { getServerUrl } = urlsConfig;

interface SshStatus {
  enabled: boolean;
  active: boolean;
  masked: boolean;
  passwordAuth: boolean | null;
  port: number | null;
  hasAuthorizedKeys: boolean;
}

interface AccountStatus {
  user: string;
  usingDefaultPassword: boolean | null;
  passwordSet: boolean | null;
  minPasswordLength: number;
}

interface Props {
  accessMode: string;
}

/**
 * Accès SSH de l'hôte + mot de passe du compte système.
 *
 * Les deux vont ensemble : l'utilisateur applicatif dispose de sudo NOPASSWD
 * (posé par install.sh), donc tant que le mot de passe par défaut de l'image est
 * en place, un accès SSH par mot de passe équivaut à un accès root. Le panneau
 * met cette conséquence en avant plutôt que d'aligner deux réglages neutres.
 */
const SshPanel: React.FC<Props> = ({ accessMode }) => {
  const { t } = useLanguage();
  const [status, setStatus] = React.useState<SshStatus | null>(null);
  const [account, setAccount] = React.useState<AccountStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [working, setWorking] = React.useState(false);
  const [confirmingDisable, setConfirmingDisable] = React.useState(false);

  // Formulaire de changement de mot de passe
  const [showPwForm, setShowPwForm] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [revealPassword, setRevealPassword] = React.useState(false);
  const [pwError, setPwError] = React.useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = React.useState(false);
  const [pwWorking, setPwWorking] = React.useState(false);

  const serverUrl = getServerUrl(accessMode || 'private');

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sshRes, accountRes] = await Promise.all([
        axios.get(`${serverUrl}/api/system/ssh`, { timeout: 15000 }),
        axios.get(`${serverUrl}/api/system/account`, { timeout: 15000 }),
      ]);
      setStatus(sshRes.data);
      setAccount(accountRes.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || t('settings.sshLoadError'));
    } finally {
      setLoading(false);
    }
  }, [serverUrl, t]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const applyEnabled = async (enabled: boolean) => {
    setConfirmingDisable(false);
    setWorking(true);
    setError(null);
    try {
      const res = await axios.post(`${serverUrl}/api/system/ssh`, { enabled }, { timeout: 60000 });
      setStatus(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || t('settings.sshUpdateError'));
      loadAll(); // l'état affiché peut être désynchronisé du système : on relit.
    } finally {
      setWorking(false);
    }
  };

  const onToggle = (checked: boolean) => {
    // Couper SSH sans clé déposée peut supprimer le seul accès shell distant.
    if (checked) applyEnabled(true);
    else setConfirmingDisable(true);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError(t('settings.sysPwMismatch'));
      return;
    }

    setPwWorking(true);
    try {
      const res = await axios.post(
        `${serverUrl}/api/system/account/password`,
        { newPassword },
        { timeout: 30000 }
      );
      setAccount({
        user: res.data.user,
        usingDefaultPassword: res.data.usingDefaultPassword,
        passwordSet: res.data.passwordSet,
        minPasswordLength: res.data.minPasswordLength,
      });
      setNewPassword('');
      setConfirmPassword('');
      setShowPwForm(false);
      setPwSuccess(true);
    } catch (e: any) {
      setPwError(e?.response?.data?.error || t('settings.sysPwError'));
    } finally {
      setPwWorking(false);
    }
  };

  const isOn = !!status?.enabled || !!status?.active;
  const minLen = account?.minPasswordLength ?? 10;
  const isDefaultPw = account?.usingDefaultPassword === true;

  if (loading) {
    return (
      <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
        <div style={{ color: '#666', padding: '8px 0' }}>{t('common.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
        <div style={styles.errorBox}>{error}</div>
      </div>
    );
  }

  return (
    <>
      {/* ---- Carte 1 : interrupteur du service SSH ---- */}
      <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
        {status && (
          <>
            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <div style={styles.label}>
                  {t('settings.sshAccess')}
                  <span style={{ ...styles.badge, ...(isOn ? styles.badgeOn : styles.badgeOff) }}>
                    {isOn ? t('settings.sshOn') : t('settings.sshOff')}
                  </span>
                </div>
                <div style={styles.hint}>
                  {isOn
                    ? t('settings.sshOnHint', { port: String(status.port ?? 22) })
                    : t('settings.sshOffHint')}
                </div>
              </div>
              <label className="switch" style={working ? { opacity: 0.5 } : undefined}>
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={working}
                  onChange={(e) => onToggle(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Le vrai risque : mot de passe accepté + sudo NOPASSWD = root à distance. */}
            {isOn && status.passwordAuth === true && (
              <div style={styles.warnBox}>
                <strong>⚠️ {t('settings.sshPasswordWarnTitle')}</strong>
                <div style={{ marginTop: 6, lineHeight: 1.5 }}>{t('settings.sshPasswordWarnText')}</div>
              </div>
            )}

            {isOn && !status.hasAuthorizedKeys && status.passwordAuth === true && (
              <div style={styles.hint}>{t('settings.sshNoKeysHint')}</div>
            )}

            {confirmingDisable && (
              <div style={styles.confirmBox}>
                <div style={{ marginBottom: 10, lineHeight: 1.5 }}>
                  {status.hasAuthorizedKeys
                    ? t('settings.sshDisableConfirm')
                    : t('settings.sshDisableConfirmNoKeys')}
                </div>
                <div style={styles.buttons}>
                  <button style={styles.secondaryBtn} onClick={() => setConfirmingDisable(false)}>
                    {t('common.cancel')}
                  </button>
                  <button style={styles.dangerBtn} onClick={() => applyEnabled(false)}>
                    {t('settings.sshConfirmDisable')}
                  </button>
                </div>
              </div>
            )}

            {working && <div style={styles.hint}>{t('settings.sshApplying')}</div>}
          </>
        )}
      </div>

      {/* ---- Carte 2 : mot de passe du compte système ---- */}
      {account && (
        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <div style={styles.label}>
            {t('settings.sysPwTitle')}
            {isDefaultPw && (
              <span style={{ ...styles.badge, ...styles.badgeDanger }}>{t('settings.sysPwDefaultBadge')}</span>
            )}
          </div>

          <div style={styles.hint}>
            {t('settings.sysPwAccount', { user: account.user })}
          </div>

          {/* On n'affirme le « mot de passe par défaut » que si la vérification a
              abouti ; usingDefaultPassword === null signifie « indéterminé ». */}
          {isDefaultPw && (
            <div style={styles.dangerBox}>
              <strong>🔓 {t('settings.sysPwDefaultTitle')}</strong>
              <div style={{ marginTop: 6, lineHeight: 1.5 }}>{t('settings.sysPwDefaultText')}</div>
            </div>
          )}

          {pwSuccess && <div style={styles.successBox}>{t('settings.sysPwChanged')}</div>}

          {!showPwForm ? (
            <div style={{ ...styles.buttons, marginTop: 14 }}>
              <button
                style={isDefaultPw ? styles.primaryBtn : styles.secondaryBtn}
                onClick={() => { setShowPwForm(true); setPwSuccess(false); setPwError(null); }}
              >
                {t('settings.sysPwChange')}
              </button>
            </div>
          ) : (
            <form onSubmit={submitPassword} style={{ marginTop: 14 }}>
              <label style={styles.fieldLabel} htmlFor="ryvie-sys-pw">{t('settings.sysPwNew')}</label>
              <input
                id="ryvie-sys-pw"
                type={revealPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
                autoComplete="new-password"
                minLength={minLen}
                required
              />

              <label style={styles.fieldLabel} htmlFor="ryvie-sys-pw2">{t('settings.sysPwConfirm')}</label>
              <input
                id="ryvie-sys-pw2"
                type={revealPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                autoComplete="new-password"
                required
              />

              <label style={styles.revealRow}>
                <input
                  type="checkbox"
                  checked={revealPassword}
                  onChange={(e) => setRevealPassword(e.target.checked)}
                />
                {t('settings.sysPwReveal')}
              </label>

              <div style={styles.hint}>{t('settings.sysPwRule', { min: String(minLen) })}</div>

              {pwError && <div style={{ ...styles.errorBox, marginTop: 10 }}>{pwError}</div>}

              <div style={{ ...styles.buttons, marginTop: 14 }}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => { setShowPwForm(false); setNewPassword(''); setConfirmPassword(''); setPwError(null); }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  style={{ ...styles.primaryBtn, ...(pwWorking ? styles.btnDisabled : {}) }}
                  disabled={pwWorking}
                >
                  {pwWorking ? t('settings.sysPwSaving') : t('settings.sysPwSave')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'center', gap: 16 },
  label: { fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase' },
  badgeOn: { background: 'rgba(60,180,120,0.18)', color: '#1e7a4d' },
  badgeOff: { background: 'rgba(120,120,120,0.18)', color: '#666' },
  badgeDanger: { background: 'rgba(220,80,80,0.16)', color: '#c0392b' },
  hint: { color: '#666', fontSize: 13, marginTop: 8, lineHeight: 1.5 },
  errorBox: { color: '#c0392b', background: 'rgba(220,80,80,0.12)', padding: 12, borderRadius: 8, fontSize: 14 },
  successBox: {
    marginTop: 12, padding: '10px 12px', borderRadius: 8, fontSize: 13.5,
    background: 'rgba(60,180,120,0.18)', color: '#1e7a4d',
  },
  warnBox: {
    marginTop: 14, padding: '12px 14px', borderRadius: 8, fontSize: 13.5,
    background: 'rgba(220,160,60,0.14)', border: '1px solid rgba(220,160,60,0.35)',
  },
  dangerBox: {
    marginTop: 14, padding: '12px 14px', borderRadius: 8, fontSize: 13.5,
    background: 'rgba(220,80,80,0.10)', border: '1px solid rgba(220,80,80,0.35)',
  },
  confirmBox: { marginTop: 14, padding: 12, borderRadius: 8, background: 'rgba(220,80,80,0.10)', fontSize: 13.5 },
  buttons: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  fieldLabel: { display: 'block', fontSize: 13, color: '#666', marginTop: 10, marginBottom: 4 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 14,
    borderRadius: 8, border: '1px solid rgba(120,120,120,0.35)', background: 'transparent',
  },
  revealRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: '#666' },
  primaryBtn: {
    background: '#3b6fe0', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 16px', fontSize: 13.5, cursor: 'pointer', fontWeight: 500,
  },
  secondaryBtn: {
    background: 'transparent', color: '#666', border: '1px solid rgba(120,120,120,0.4)',
    borderRadius: 8, padding: '8px 16px', fontSize: 13.5, cursor: 'pointer',
  },
  dangerBtn: {
    background: 'rgba(220,80,80,0.12)', color: '#dc2626', border: '1px solid rgba(220,80,80,0.4)',
    borderRadius: 8, padding: '8px 16px', fontSize: 13.5, cursor: 'pointer', fontWeight: 500,
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
};

export default SshPanel;
