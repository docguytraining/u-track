import { useState } from 'react';
import { useStore } from '../store';
import { Topbar, OptionGroup, VolumeField, WhenField } from '../ui';

/**
 * Logging a void — one trip to empty your bladder in the toilet (a continent void, the only
 * kind that feeds capacity / frequency / NPi). Anything that went into a product or onto
 * clothing is an involuntary loss and is logged from the Leak screen, so this stays a single,
 * clean "I went to the bathroom" flow. A void visit can still carry a product *change* — "I
 * peed and changed my brief while I was in there" — which rides along as its own event.
 */
export function LogVoid() {
  const { coreQuestions, gatewayQuestions, measuredDay, logVoid, logChange, navigate, products, enabledModules } = useStore();
  const core = coreQuestions('void');
  const gateway = gatewayQuestions('void');
  const usesProtection = enabledModules.includes('protection');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [changed, setChanged] = useState('');
  const [fullness, setFullness] = useState('');

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const done = () => {
    const t = at ?? undefined;
    logVoid({ where: 'toilet', leaked: false, volumeMl, size: null, productId: null, answers, at: t });
    // A change can ride along with a toilet void — "I peed and changed my brief while I was in
    // there" is a continent void plus a change, two events from one visit.
    if (changed === 'Yes') logChange({ productId: productId || null, volumeMl: null, answers: fullness ? { fullness } : {}, at: t });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Log a void" onBack={() => navigate('home')} />
      <p className="lead">
        A void is one trip to empty your bladder in the toilet. Add a detail if you want, then tap Done.{' '}
        If urine came out on its own,{' '}
        <button onClick={() => navigate('leak')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>log a leak instead</button>.
      </p>

      {measuredDay && <p className="note" style={{ marginBottom: -4 }}>Measured day — a volume on every void is what unlocks the NPi.</p>}
      <VolumeField valueMl={volumeMl} onChange={setVolumeMl} products={products} />

      {core.map((q) => (
        <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
      ))}

      {core.length === 0 && !measuredDay && (
        <p className="note">Your profile keeps the daytime void a pure tap — nothing else to ask.</p>
      )}

      {/* Peed in the toilet AND changed a product that was wet from earlier — one visit, two
          events (a continent void + a change). */}
      {usesProtection && (
        <>
          <OptionGroup
            question={{ id: 'changed', surface: 'void', coreEligible: false, priority: 0, prompt: 'Did you also change your product while you were there?', options: ['No', 'Yes'] }}
            value={changed}
            onChange={setChanged}
          />
          {changed === 'Yes' && (
            <>
              {products.length > 1 && (
                <div className="field">
                  <label>Which product did you remove? — optional</label>
                  <div className="chips">
                    {products.map((p) => (
                      <button key={p.id} className={productId === p.id ? 'selected' : ''} onClick={() => setProductId(p.id)}>{p.name}</button>
                    ))}
                  </div>
                </div>
              )}
              <OptionGroup
                question={{ id: 'fullness', surface: 'void', coreEligible: false, priority: 0, prompt: 'How full was it?', options: ['Light', 'Moderate', 'Heavy', 'Saturated'] }}
                value={fullness}
                onChange={setFullness}
              />
            </>
          )}
        </>
      )}

      {gateway.length > 0 && !showMore && (
        <button className="ghost block center" onClick={() => setShowMore(true)}>
          Track anything else? ({gateway.length})
        </button>
      )}
      {showMore && gateway.map((q) => (
        <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
      ))}

      <WhenField value={at} onChange={setAt} />

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>Done</button>
    </div>
  );
}
