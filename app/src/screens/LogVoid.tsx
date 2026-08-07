import { useState } from 'react';
import { useStore } from '../store';
import { Topbar, OptionGroup, VolumeField, WhenField } from '../ui';

export function LogVoid() {
  const { coreQuestions, gatewayQuestions, measuredDay, logVoid, navigate, products } = useStore();
  const core = coreQuestions('void');
  const gateway = gatewayQuestions('void');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const done = () => {
    logVoid({ volumeMl, answers, at: at ?? undefined });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Void logged ✓" onBack={() => navigate('home')} />
      <p className="lead">Timestamped. That alone is complete — add detail only if you want.</p>

      {measuredDay && <p className="note" style={{ marginBottom: -4 }}>Measured day — a volume on every void is what unlocks the NPi.</p>}
      <VolumeField valueMl={volumeMl} onChange={setVolumeMl} products={products} />

      {core.map((q) => (
        <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
      ))}

      {core.length === 0 && !measuredDay && (
        <p className="note">Your profile keeps the daytime void a pure tap — nothing else to ask.</p>
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
