import { useState } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { signInWithGoogle, signInEmailPassword, createAccount, sendMagicLink, usingEmulator } from '../firebase';

export function SignIn() {
  const { navigate, entries, onboarded } = useStore();
  const localCount = entries.length;
  const back = () => navigate(onboarded ? 'settings' : 'onboarding');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const fail = (e: unknown) =>
    setMsg({ text: (e as { message?: string })?.message?.replace(/^Firebase:\s*/, '') ?? 'Something went wrong.' });

  // Warn before leaving guest mode when there's unsynced local data.
  const confirmLeaveGuest = () =>
    localCount === 0 ||
    window.confirm(
      `You have ${localCount} ${localCount === 1 ? 'entry' : 'entries'} on this device.\n\n` +
        `Signing into a NEW account keeps them. Signing into an account that ALREADY has data ` +
        `switches to that data and drops these. Continue?`,
    );

  const run = async (fn: () => Promise<unknown>) => {
    if (!confirmLeaveGuest()) return;
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      navigate('home'); // onAuth hydrates and routes; App gates on onboarded
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const link = async () => {
    if (!email.trim()) return setMsg({ text: 'Enter your email first.' });
    if (!confirmLeaveGuest()) return;
    setBusy(true);
    setMsg(null);
    try {
      await sendMagicLink(email.trim());
      setMsg({ text: `Sign-in link sent to ${email.trim()}. Open it on this device to finish.`, ok: true });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <Topbar title="Sign in" onBack={back} />
      <p className="lead">Sync your diary across your phone and iPad. Your data is private to your account.{usingEmulator ? ' (Emulator — any account works.)' : ''}</p>

      {localCount > 0 && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <b>{localCount} {localCount === 1 ? 'entry' : 'entries'} on this device.</b>
          <div className="sub" style={{ marginTop: 4 }}>
            A new account keeps them. An existing account switches to its own data and drops these.
          </div>
        </div>
      )}

      <button className="primary block center big" disabled={busy} onClick={() => run(signInWithGoogle)}>
        Continue with Google
      </button>

      <div className="hr" />

      <div className="field">
        <label>Email</label>
        <input className="numinput" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Password</label>
        <input className="numinput" type="password" autoComplete="current-password" placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div className="grid">
        <button className="center" disabled={busy} onClick={() => run(() => signInEmailPassword(email.trim(), pw))}>Sign in</button>
        <button className="center" disabled={busy} onClick={() => run(() => createAccount(email.trim(), pw))}>Create account</button>
      </div>

      <div className="hr" />
      <button className="ghost block center" disabled={busy} onClick={link}>Email me a sign-in link instead</button>

      {msg && <p className="note" style={{ color: msg.ok ? 'var(--accent)' : 'var(--warn)' }}>{msg.text}</p>}

      <div className="spacer-v" />
      <button className="ghost block center" onClick={back}>Cancel</button>
    </div>
  );
}
