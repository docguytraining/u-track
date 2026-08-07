import { useState } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { signInWithGoogle, signInEmailPassword, createAccount, sendMagicLink, usingEmulator } from '../firebase';

export function SignIn() {
  const { navigate } = useStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const fail = (e: unknown) =>
    setMsg({ text: (e as { message?: string })?.message?.replace(/^Firebase:\s*/, '') ?? 'Something went wrong.' });

  const run = async (fn: () => Promise<unknown>) => {
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
      <Topbar title="Sign in" onBack={() => navigate('settings')} />
      <p className="lead">Sync your diary across your phone and iPad. Your data is private to your account.{usingEmulator ? ' (Emulator — any account works.)' : ''}</p>

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
      <button className="ghost block center" onClick={() => navigate('settings')}>Cancel — keep using locally</button>
    </div>
  );
}
