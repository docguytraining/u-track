import { useState } from 'react';
import { useStore } from '../store';
import { Topbar, OptionGroup, WhenField } from '../ui';

export function LogLeak() {
  const { coreQuestions, gatewayQuestions, logLeak, navigate, enabledModules } = useStore();
  const usesProtection = enabledModules.includes('protection');
  const core = coreQuestions('leak');
  // "Did you feel it happen?" earns a permanent place here: a leak you didn't notice is exactly
  // the kind of event this screen exists to capture, so it's offered to everyone — not gated to
  // reduced-sensation profiles the way it is on the void screen.
  const gateway = gatewayQuestions('leak');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [at, setAt] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const done = () => {
    logLeak(answers, at ?? undefined);
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Log a leak" onBack={() => navigate('home')} />
      <p className="lead">A leak is urine that came out when you didn't mean it to — any amount, even a few drops you barely noticed, onto your clothing, skin, or the bed.</p>
      {usesProtection && (
        <p className="note" style={{ marginTop: -6 }}>
          If it went into your protection instead, log it as a{' '}
          <button onClick={() => navigate('void')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>void into your product</button> — same event, just caught.
        </p>
      )}

      {core.map((q) => (
        <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
      ))}

      {core.length === 0 && (
        <p className="note">Your profile keeps a leak a pure tap — no quick questions to ask.</p>
      )}

      {gateway.length > 0 && !showMore && (
        <button className="ghost block center" onClick={() => setShowMore(true)}>
          Track anything else? ({gateway.length})
        </button>
      )}
      {showMore &&
        gateway.map((q) => (
          <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
        ))}

      <WhenField value={at} onChange={setAt} />

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>
        Done
      </button>
    </div>
  );
}
