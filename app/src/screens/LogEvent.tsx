import { useState } from 'react';
import { useStore } from '../store';
import { Topbar, OptionGroup, VolumeField, WhenField } from '../ui';

/**
 * The single log button. One event — "urine left my bladder" — described by two answers that
 * are the whole of Step 1: WHERE it went and HOW MUCH. Those two decide everything else, so the
 * only follow-ups shown are the ones that pair actually warrants (most pairs are save-and-done).
 *
 * Nothing here asks "void or leak" — that's derived (toilet = a continent void; anything else =
 * a leak, graded by size). Amount is a qualitative size by default; a real measured volume only
 * appears during a 24-hour check (measured day), at the bottom of the branch. And nothing asks
 * "did you feel it": if you're logging it live you noticed it, and a loss you didn't notice
 * surfaces later as a product change that's wetter than what you logged.
 */
const WHERE = ['Toilet', 'Into protection', 'Clothing or bed'];
const SIZES = ['Dribble', 'Small', 'Moderate', 'Large', 'Full'];

export function LogEvent() {
  const { coreQuestions, measuredDay, logEvent, navigate, products, enabledModules } = useStore();
  const [where, setWhere] = useState('');
  const [size, setSize] = useState('');
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [escaped, setEscaped] = useState('');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [at, setAt] = useState<number | null>(null);
  const [more, setMore] = useState(false);

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));

  const ready = where !== '' && size !== '';
  const isToilet = where === 'Toilet';
  const isProduct = where === 'Into protection';
  const isClothing = where === 'Clothing or bed';
  const dribble = size === 'Dribble';

  // The questions each cell can reveal, pulled from the profile's own question set.
  const voidQs = coreQuestions('void');
  const leakQs = coreQuestions('leak');
  const urgencyQ = voidQs.find((q) => q.id === 'urgency');
  const triggerQ = leakQs.find((q) => q.id === 'leakTrigger');
  const emptyingQs = voidQs.filter((q) => ['stream', 'incomplete', 'intermittency'].includes(q.id));

  // What "add more" would show for this where × size. A dribble into protection has nothing.
  const escapeQ = isProduct && !dribble;
  const triggerCell = (isProduct || isClothing) && !dribble && triggerQ;
  const urgencyCell = isToilet && !dribble && urgencyQ;
  const emptyingCell = isToilet && dribble && emptyingQs.length > 0; // a toilet dribble → emptying signal
  const measuredVolumeCell = isToilet && measuredDay; // real mL only during the 24-hour check
  const hasMore = escapeQ || triggerCell || urgencyCell || emptyingCell || measuredVolumeCell;

  const done = () => {
    logEvent({
      where: isToilet ? 'toilet' : isProduct ? 'product' : 'clothing',
      size,
      escaped: isProduct && escaped === 'Yes',
      volumeMl: measuredVolumeCell ? volumeMl : null,
      productId: isProduct ? productId || null : null,
      answers,
      at: at ?? undefined,
    });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Log it" onBack={() => navigate('home')} />
      <p className="lead">Two quick taps — where it went and roughly how much. Then save, or add a detail.</p>

      {/* Step 1 — the two answers that drive everything. */}
      <OptionGroup
        question={{ id: 'where', surface: 'void', coreEligible: false, priority: 0, prompt: 'Where did it go?', options: WHERE }}
        value={where}
        onChange={setWhere}
      />
      <OptionGroup
        question={{ id: 'size', surface: 'void', coreEligible: false, priority: 0, prompt: 'How much?', options: SIZES }}
        value={size}
        onChange={setSize}
      />

      {ready && (
        <>
          {hasMore && !more && (
            <button className="ghost block center" onClick={() => setMore(true)}>Add a detail</button>
          )}

          {more && (
            <>
              {measuredVolumeCell && (
                <>
                  <p className="note" style={{ marginBottom: -4 }}>Measured day — a real volume is what unlocks the NPi.</p>
                  <VolumeField valueMl={volumeMl} onChange={setVolumeMl} products={products} />
                </>
              )}
              {escapeQ && (
                <OptionGroup
                  question={{ id: 'escaped', surface: 'leak', coreEligible: false, priority: 0, prompt: 'Did any escape onto clothing or the bed?', options: ['No', 'Yes'] }}
                  value={escaped}
                  onChange={setEscaped}
                />
              )}
              {urgencyCell && urgencyQ && <OptionGroup question={urgencyQ} value={answers[urgencyQ.id]} onChange={(v) => set(urgencyQ.id, v)} />}
              {triggerCell && triggerQ && <OptionGroup question={triggerQ} value={answers[triggerQ.id]} onChange={(v) => set(triggerQ.id, v)} />}
              {emptyingCell && emptyingQs.map((q) => (
                <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
              ))}
              {isProduct && products.length > 1 && (
                <div className="field">
                  <label>Which product? — optional</label>
                  <div className="chips">
                    {products.map((p) => (
                      <button key={p.id} className={productId === p.id ? 'selected' : ''} onClick={() => setProductId(p.id)}>{p.name}</button>
                    ))}
                  </div>
                </div>
              )}
              <WhenField value={at} onChange={setAt} />
            </>
          )}

          <div className="spacer-v" />
          <button className="primary block center" onClick={done}>Save</button>
        </>
      )}
    </div>
  );
}
