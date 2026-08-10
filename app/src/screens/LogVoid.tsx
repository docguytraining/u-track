import { useState } from 'react';
import { useStore } from '../store';
import { sometimesMissesToilet } from '../insights';
import { Topbar, OptionGroup, VolumeField, WhenField } from '../ui';

/**
 * One "I emptied my bladder" entry point. For someone who wears protection and sometimes
 * doesn't reach the toilet in time, it forks on where it actually went:
 *   • Made it        → a normal continent void (unchanged flow).
 *   • Partly         → some reached the toilet, some the product → a void AND a wetting.
 *   • No             → all into the product → a wetting.
 * When it went into the product it also asks whether you changed the product, so a single
 * logging moment can record the void, the wetting, and the change together.
 */
export function LogVoid() {
  const { coreQuestions, gatewayQuestions, measuredDay, logVoid, logWetting, logChange, navigate, products, enabledModules, traits } = useStore();
  const core = coreQuestions('void');
  const gateway = gatewayQuestions('void');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Only offer the fork when the profile says voids sometimes don't reach the toilet —
  // otherwise every void gets irrelevant questions.
  const askMadeIt = sometimesMissesToilet(enabledModules, traits);
  const [madeIt, setMadeIt] = useState('');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [wetReason, setWetReason] = useState('');
  const [amount, setAmount] = useState('');
  const [changed, setChanged] = useState('');
  const [fullness, setFullness] = useState('');

  const partly = madeIt === 'Partly';
  const intoProduct = madeIt === 'No' || partly;

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const done = () => {
    const t = at ?? undefined;
    if (intoProduct) {
      // Always a wetting into the product — no volume, feeds frequency not volume.
      logWetting({
        productId: productId || null,
        answers: { madeIt, ...(wetReason ? { wetReason } : {}), ...(amount ? { amount } : {}) },
        at: t,
      });
      // Partly → the toilet caught some of it: record that continent portion as a void.
      if (partly) logVoid({ volumeMl, answers: {}, at: t });
      // Changed the product in the same moment → also a change (the "double up").
      if (changed === 'Yes') logChange({ productId: productId || null, volumeMl: null, answers: fullness ? { fullness } : {}, at: t });
    } else {
      logVoid({ volumeMl, answers, at: t });
    }
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title={intoProduct ? 'Logged ✓' : 'Void logged ✓'} onBack={() => navigate('home')} />
      <p className="lead">Timestamped. That alone is complete — add detail only if you want.</p>

      {askMadeIt && (
        <OptionGroup
          question={{ id: 'madeIt', surface: 'void', coreEligible: false, priority: 0, prompt: 'Did you make it to the toilet in time?', options: ['Yes', 'Partly', 'No'] }}
          value={madeIt}
          onChange={setMadeIt}
        />
      )}

      {intoProduct ? (
        <>
          <p className="note" style={{ marginTop: -4 }}>
            {partly
              ? 'Some in the toilet, some in your protection — logging both, so your frequency stays honest.'
              : 'Into your protection — logged as a wetting: it counts toward how often you go, not toward volume.'}
          </p>

          <OptionGroup
            question={{ id: 'wetReason', surface: 'void', coreEligible: false, priority: 0, prompt: 'What happened?', options: ['Sudden urge', 'Couldn’t get there in time', 'Didn’t feel it coming', 'While undressing'] }}
            value={wetReason}
            onChange={setWetReason}
          />
          <OptionGroup
            question={{ id: 'amount', surface: 'void', coreEligible: false, priority: 0, prompt: 'How much went into the product?', options: ['A little', 'Moderate', 'A lot'] }}
            value={amount}
            onChange={setAmount}
          />

          {partly && (
            <>
              <p className="note" style={{ marginBottom: -4 }}>How much reached the toilet? — optional</p>
              <VolumeField valueMl={volumeMl} onChange={setVolumeMl} products={products} />
            </>
          )}

          {products.length > 1 && (
            <div className="field">
              <label>Which product? — optional</label>
              <div className="chips">
                {products.map((p) => (
                  <button key={p.id} className={productId === p.id ? 'selected' : ''} onClick={() => setProductId(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <OptionGroup
            question={{ id: 'changed', surface: 'void', coreEligible: false, priority: 0, prompt: 'Did you change the product?', options: ['Yes', 'No'] }}
            value={changed}
            onChange={setChanged}
          />
          {changed === 'Yes' && (
            <OptionGroup
              question={{ id: 'fullness', surface: 'void', coreEligible: false, priority: 0, prompt: 'How full was it? — optional', options: ['Light', 'Moderate', 'Heavy', 'Saturated'] }}
              value={fullness}
              onChange={setFullness}
            />
          )}
        </>
      ) : (
        <>
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
        </>
      )}

      <WhenField value={at} onChange={setAt} />

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>
        Done
      </button>
    </div>
  );
}
