import { useState } from 'react';
import { useStore } from '../store';
import { awarenessReduced } from '../insights';
import { Topbar, OptionGroup, WhenField } from '../ui';

export function LogLeak() {
  const { coreQuestions, gatewayQuestions, logLeak, navigate, traits } = useStore();
  const core = coreQuestions('leak');
  // The awareness question only earns its place for reduced-sensation profiles.
  const gateway = gatewayQuestions('leak').filter((q) => q.id !== 'leakAwareness' || awarenessReduced(traits));
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
      <p className="lead">Add a detail or two if you want — then hit Done.</p>

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
