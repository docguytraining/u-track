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
  const [containment, setContainment] = useState('');
  const [showMore, setShowMore] = useState(false);

  const contained = containment === 'Stayed in my protection';
  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const done = () => {
    // Record containment on the answers too, so it shows in the log/CSV, and pass it through so
    // the entry lands in the right shape (contained vs reached clothing).
    logLeak(containment ? { ...answers, containment } : answers, at ?? undefined, { contained });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Log a leak" onBack={() => navigate('home')} />
      <p className="lead">A leak is urine that came out when you didn't mean it to — any amount, even a few drops you barely noticed.</p>

      {usesProtection && (
        <OptionGroup
          question={{ id: 'containment', surface: 'leak', coreEligible: false, priority: 0, prompt: 'Where did it end up?', options: ['Stayed in my protection', 'Reached clothing or bed'] }}
          value={containment}
          onChange={setContainment}
        />
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
