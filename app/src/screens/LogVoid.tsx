import { useState } from 'react';
import { useStore } from '../store';
import { sometimesMissesToilet } from '../insights';
import { Topbar, OptionGroup, VolumeField, WhenField } from '../ui';

/**
 * One entry point for "I emptied my bladder." For someone who wears protection and whose
 * profile shows they sometimes don't reach the toilet, the first question is where it
 * went, and the flow fans out from there:
 *   • Toilet   → a normal continent void.
 *   • Product  → all into protection → a wetting (an incontinence episode).
 *   • Both     → some in the toilet, some in the product → a void AND a wetting.
 *
 * A wetting is an incontinence episode, so it borrows the leak surface's questions. The
 * MAIN questions on any surface are the ones tied to a diagnostic instrument (here the
 * leak severity + trigger, the ICIQ items); everything else — awareness, whether you
 * changed the product, its fullness — is optional and lives behind "Track anything else?",
 * never required.
 */
export function LogVoid() {
  const { coreQuestions, gatewayQuestions, measuredDay, logVoid, logWetting, logChange, navigate, products, enabledModules, traits } = useStore();
  const core = coreQuestions('void');
  const gateway = gatewayQuestions('void');
  // A wetting is a leak-family event — its instrument-tied questions come from that surface.
  const leakCore = coreQuestions('leak');
  const leakGateway = gatewayQuestions('leak');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Only branch when the profile says voids sometimes don't reach the toilet — otherwise
  // a fully continent person gets an irrelevant question on every void.
  const askDest = sometimesMissesToilet(enabledModules, traits);
  const [dest, setDest] = useState('');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [changed, setChanged] = useState('');
  const [fullness, setFullness] = useState('');

  const both = dest === 'Both';
  const intoProduct = dest === 'Product' || both;

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const done = () => {
    const t = at ?? undefined;
    if (intoProduct) {
      // Into protection → a wetting: no volume, feeds frequency not volume.
      logWetting({ productId: productId || null, answers: { destination: dest, ...answers }, at: t });
      // Both → the toilet caught some of it: record that continent portion as a void.
      if (both) logVoid({ volumeMl, answers: {}, at: t });
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

      {askDest && (
        <OptionGroup
          question={{ id: 'destination', surface: 'void', coreEligible: false, priority: 0, prompt: 'Where did it go?', options: ['Toilet', 'Product', 'Both'] }}
          value={dest}
          onChange={setDest}
        />
      )}

      {intoProduct ? (
        <>
          <p className="note" style={{ marginTop: -4 }}>
            {both
              ? 'Some in the toilet, some in your protection — logging both, so your frequency stays honest.'
              : 'Into your protection — logged as a wetting: it counts toward how often you go, not toward volume.'}
          </p>

          {/* Both → the toilet portion is a real (partial) void; its volume feeds the chart. */}
          {both && (
            <>
              <p className="note" style={{ marginBottom: -4 }}>How much reached the toilet? — optional</p>
              <VolumeField valueMl={volumeMl} onChange={setVolumeMl} products={products} />
            </>
          )}

          {/* Main: the incontinence-episode questions tied to the instrument. */}
          {leakCore.map((q) => (
            <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
          ))}

          {/* Additional: optional, never required — awareness, and whether you changed. */}
          {!showMore && (
            <button className="ghost block center" onClick={() => setShowMore(true)}>
              Track anything else?
            </button>
          )}
          {showMore && (
            <>
              {leakGateway.map((q) => (
                <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
              ))}

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
                question={{ id: 'changed', surface: 'leak', coreEligible: false, priority: 0, prompt: 'Did you change the product?', options: ['Yes', 'No'] }}
                value={changed}
                onChange={setChanged}
              />
              {changed === 'Yes' && (
                <OptionGroup
                  question={{ id: 'fullness', surface: 'leak', coreEligible: false, priority: 0, prompt: 'How full was it?', options: ['Light', 'Moderate', 'Heavy', 'Saturated'] }}
                  value={fullness}
                  onChange={setFullness}
                />
              )}
            </>
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
