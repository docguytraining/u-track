import { useState } from 'react';
import { useStore } from '../store';
import { sometimesMissesToilet, awarenessReduced } from '../insights';
import { Topbar, OptionGroup, VolumeField, WhenField } from '../ui';

/**
 * One entry point for a void — a bladder emptying. For someone who wears protection and
 * whose profile shows they sometimes don't reach the toilet, it asks where it ended up
 * and records a single void with that fact attached:
 *   • Toilet   → a normal continent void (measured volume).
 *   • Product  → into protection; perceived size (can't weigh mid-product); may have leaked.
 *   • Both     → some reached the toilet (measured) and some the product.
 * The product/both paths can also log a change in the same step. Escape (leaking) is its
 * own axis, asked on the product paths where it's the product-adequacy signal; the Leak
 * button on the home screen is the fast path for a pure escape.
 */
const SIZES = ['Small', 'Medium', 'Large'];

export function LogVoid() {
  const { coreQuestions, gatewayQuestions, measuredDay, logVoid, logChange, navigate, products, enabledModules, traits } = useStore();
  const core = coreQuestions('void');
  const gateway = gatewayQuestions('void');
  const urgencyQ = core.find((q) => q.id === 'urgency'); // ties urgency to a product void too
  const leakCore = coreQuestions('leak');
  const triggerQ = leakCore.find((q) => q.id === 'leakTrigger'); // why it happened — always relevant
  const severityQ = leakCore.find((q) => q.id === 'leakSeverity'); // how much *leaked* — only if it did
  const leakGateway = gatewayQuestions('leak').filter((q) => q.id !== 'leakAwareness' || awarenessReduced(traits));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [size, setSize] = useState('');
  const [at, setAt] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);

  const askDest = sometimesMissesToilet(enabledModules, traits);
  const [dest, setDest] = useState('');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [leaked, setLeaked] = useState('');
  const [changed, setChanged] = useState('');
  const [fullness, setFullness] = useState('');

  const both = dest === 'Both';
  const intoProduct = dest === 'Product' || both;
  const where = !askDest || dest === 'Toilet' ? 'toilet' : both ? 'both' : intoProduct ? 'product' : 'toilet';

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const done = () => {
    const t = at ?? undefined;
    logVoid({
      where,
      leaked: leaked === 'Yes',
      // Measured volume only when the toilet caught it; a product void carries a perceived size.
      volumeMl: intoProduct && !both ? null : volumeMl,
      size: intoProduct ? size || null : null,
      productId: intoProduct ? productId || null : null,
      answers,
      at: t,
    });
    if (intoProduct && changed === 'Yes') logChange({ productId: productId || null, volumeMl: null, answers: fullness ? { fullness } : {}, at: t });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Log a void" onBack={() => navigate('home')} />
      <p className="lead">Add a detail if you want — then tap Done to log it.</p>

      {askDest && (
        <OptionGroup
          question={{ id: 'destination', surface: 'void', coreEligible: false, priority: 0, prompt: 'Where did it go?', options: ['Toilet', 'Product', 'Both'] }}
          value={dest}
          onChange={setDest}
        />
      )}

      {/* Nothing else appears until we know where it went — one question at a time. */}
      {(!askDest || dest !== '') && (
      <>
      {intoProduct ? (
        <>
          <p className="note" style={{ marginTop: -4 }}>
            {both ? 'Some in the toilet, some in your protection.' : 'Into your protection.'} It counts toward how often you go.
          </p>

          {both ? (
            <>
              <p className="note" style={{ marginBottom: -4 }}>How much reached the toilet? — optional</p>
              <VolumeField valueMl={volumeMl} onChange={setVolumeMl} products={products} />
            </>
          ) : (
            <OptionGroup
              question={{ id: 'size', surface: 'void', coreEligible: false, priority: 0, prompt: 'How big was it? — optional', options: SIZES }}
              value={size}
              onChange={setSize}
            />
          )}

          {urgencyQ && <OptionGroup question={urgencyQ} value={answers[urgencyQ.id]} onChange={(v) => set(urgencyQ.id, v)} />}
          {triggerQ && <OptionGroup question={triggerQ} value={answers[triggerQ.id]} onChange={(v) => set(triggerQ.id, v)} />}

          {/* Escape is its own axis; "how much leaked" only makes sense once something did. */}
          <OptionGroup
            question={{ id: 'leaked', surface: 'leak', coreEligible: false, priority: 0, prompt: 'Did any leak through — onto clothing or the bed?', options: ['No', 'Yes'] }}
            value={leaked}
            onChange={setLeaked}
          />
          {leaked === 'Yes' && severityQ && (
            <OptionGroup question={severityQ} value={answers[severityQ.id]} onChange={(v) => set(severityQ.id, v)} />
          )}

          {!showMore && (
            <button className="ghost block center" onClick={() => setShowMore(true)}>Track anything else?</button>
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
                      <button key={p.id} className={productId === p.id ? 'selected' : ''} onClick={() => setProductId(p.id)}>{p.name}</button>
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
          {showMore && gateway.map((q) => (
            <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
          ))}
        </>
      )}

      <WhenField value={at} onChange={setAt} />

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>Done</button>
      </>
      )}
    </div>
  );
}
