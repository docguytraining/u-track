import { useState } from 'react';
import { useStore } from '../store';
import { Topbar, OptionGroup, WhenField } from '../ui';

/**
 * Log a wetting that did NOT merit a change — urine into your protection while it
 * stays on. This is the event that a "change" alone can't capture: a change records
 * how full the product got, but not *when* (or how often) you actually wet. Those
 * timestamps are what make voiding frequency honest — an insensate wetting is still a
 * bladder emptying, just not into a toilet. No weigh field here: the product stayed on,
 * so there's nothing to weigh; the next change's weight still captures the fluid.
 */
export function LogWet() {
  const { products, logWetting, navigate } = useStore();
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [at, setAt] = useState<number | null>(null);

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const done = () => {
    logWetting({ productId: productId || null, answers, at: at ?? undefined });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Wetting logged ✓" onBack={() => navigate('home')} />
      <p className="lead">
        A wet you didn’t change for. Timestamping it is the whole point — it counts toward
        voiding frequency the way a change can’t. Add a detail or two, or just hit Done.
      </p>

      <OptionGroup
        question={{ id: 'amount', surface: 'leak', coreEligible: false, priority: 0, prompt: 'How much?', options: ['A little', 'Moderate', 'A lot'] }}
        value={answers.amount}
        onChange={(v) => set('amount', v)}
      />

      <OptionGroup
        question={{ id: 'wetAwareness', surface: 'leak', coreEligible: false, priority: 0, prompt: 'Did you feel it happen?', options: ['Felt it happen', 'Felt the urge first', 'Found out after', 'Unsure'] }}
        value={answers.wetAwareness}
        onChange={(v) => set('wetAwareness', v)}
      />

      {products.length > 1 && (
        <div className="field">
          <label>Into which product? — optional</label>
          <div className="chips">
            {products.map((p) => (
              <button key={p.id} className={productId === p.id ? 'selected' : ''} onClick={() => setProductId(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <WhenField value={at} onChange={setAt} />

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>
        Done
      </button>
    </div>
  );
}
