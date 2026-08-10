import { useState } from 'react';
import { useStore } from '../store';
import { Topbar, OptionGroup, VolumeField } from '../ui';
import { toiletVoidsOf, timeStr, awarenessReduced } from '../insights';

const BED: [string, number][] = [
  ['9pm', 21], ['10pm', 22], ['11pm', 23], ['12am', 0], ['1am', 1], ['2am', 2], ['3am', 3],
];
const RISE: [string, number][] = [
  ['5am', 5], ['6am', 6], ['7am', 7], ['8am', 8], ['9am', 9], ['10am', 10], ['11am', 11],
];

// Evening bedtimes belong to the night before; after-midnight ones are this morning.
const risingFor = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.getTime(); };
const bedtimeFor = (h: number) => {
  const d = new Date();
  if (h >= 18) d.setDate(d.getDate() - 1);
  d.setHours(h, 0, 0, 0);
  return d.getTime();
};

export function Morning() {
  const { coreQuestions, gatewayQuestions, logNight, logChange, navigate, products, entries, traits } = useStore();
  // Only the instrument-tied questions are on the fast path; the rest wait behind
  // "Track anything else?" — the more we ask up front, the less gets answered.
  const core = coreQuestions('morning');
  const gateway = gatewayQuestions('morning');

  const [bedHour, setBedHour] = useState(23);
  const [riseHour, setRiseHour] = useState(7);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [firstVoidMl, setFirstVoidMl] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);

  const bedTs = bedtimeFor(bedHour);
  const riseTs = risingFor(riseHour);
  // Did the night end wet? Then the overnight output is in the product, not the toilet.
  const wet = ['Damp', 'Wet', 'Soaked'].includes(answers.wetDry ?? '') || answers.howWasNight === 'Woke wet';
  // The awareness question is only worth asking on a wet night AND only for someone whose
  // profile says sensation is reduced — for anyone else it's noise. Hidden otherwise.
  const gatewayShown = gateway.filter((q) => q.id !== 'wetAwareness' || (wet && awarenessReduced(traits)));

  // Voids you already logged while in bed — reconcile against these instead of asking blind.
  // Bathroom trips only — a product wetting or a leak overnight isn't "getting up to pee".
  const overnight = toiletVoidsOf(entries).filter((v) => v.at > bedTs && v.at < riseTs).sort((a, b) => a.at - b.at);
  const loggedCount = overnight.length;

  const wokeAnswer = ['Woke to pee', 'Woke several times', 'Woke wet'].includes(answers.howWasNight ?? '');
  const showTrips = loggedCount > 0 || wokeAnswer;
  const total = answers.nightVoids ?? String(loggedCount);

  const set = (q: string, v: string) => setAnswers((a) => ({ ...a, [q]: v }));
  const save = () => {
    if (wet) {
      // Overnight urine went into the product → record it as a change near rising, where
      // it counts toward NUV via the weighed-volume path — NOT as a phantom toilet void.
      if (firstVoidMl != null) logChange({ productId: products[0]?.id ?? null, volumeMl: firstVoidMl, answers: {}, at: riseTs + 5 * 60_000 });
      logNight({ bedtime: bedTs, rising: riseTs, firstVoidVolumeMl: null, answers: { nightVoids: total, ...answers } });
    } else {
      logNight({ bedtime: bedTs, rising: riseTs, firstVoidVolumeMl: firstVoidMl, answers: { nightVoids: total, ...answers } });
    }
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Morning check-in" onBack={() => navigate('home')} />
      <p className="lead">Reconstruct last night — this is the safety net for what you didn’t log live.</p>

      <div className="field">
        <label>When did you go to bed?</label>
        <div className="chips">
          {BED.map(([l, h]) => (
            <button key={h} className={bedHour === h ? 'selected' : ''} onClick={() => setBedHour(h)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>When did you get up?</label>
        <div className="chips">
          {RISE.map(([l, h]) => (
            <button key={h} className={riseHour === h ? 'selected' : ''} onClick={() => setRiseHour(h)}>{l}</button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 2 }}>Sets the overnight window — which trips count as nighttime.</p>
      </div>

      {core.map((q) => (
        <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
      ))}

      {/* Nocturia frequency — reconciled against what you logged overnight. */}
      {showTrips && (
        <div className="field">
          <label>Trips to the bathroom overnight</label>
          {loggedCount > 0 ? (
            <>
              <p className="note" style={{ marginTop: -2 }}>You logged {loggedCount} while in bed. Did you miss any?</p>
              <div className="list">
                {overnight.map((v) => (
                  <div className="logline" key={v.id}><span>{timeStr(v.at)}</span><b>{v.volumeMl == null ? 'no volume' : `${v.volumeMl} ml`}</b></div>
                ))}
              </div>
            </>
          ) : (
            <p className="note" style={{ marginTop: -2 }}>You didn’t log any overnight. How many times did you get up?</p>
          )}
          <div className="chips">
            {[0, 1, 2, 3, 4, 5].map((n) => {
              const label = n === 5 ? '5+' : String(n);
              return (
                <button key={label} className={total === label ? 'selected' : ''} onClick={() => set('nightVoids', label)}>
                  {label}
                </button>
              );
            })}
          </div>
          {loggedCount > 0 && Number(total) < loggedCount && (
            <p className="note" style={{ color: 'var(--warn)' }}>That’s fewer than the {loggedCount} you logged.</p>
          )}
        </div>
      )}

      <div className="hr" />
      {/* The first-morning volume — a toilet void on a dry night, the weighed product on a wet one. */}
      <div className="field">
        {wet ? (
          <>
            <label>How wet was your protection?</label>
            <p className="note" style={{ marginTop: -2 }}>Weigh it for the overnight volume — the number that powers the night report.</p>
          </>
        ) : (
          <>
            <label>First morning void</label>
            <p className="note" style={{ marginTop: -2 }}>The single most useful number in the whole chart.</p>
          </>
        )}
        <VolumeField valueMl={firstVoidMl} onChange={setFirstVoidMl} products={products} />
      </div>

      {gatewayShown.length > 0 && !showMore && (
        <button className="ghost block center" onClick={() => setShowMore(true)}>
          Track anything else? ({gatewayShown.length})
        </button>
      )}
      {showMore &&
        gatewayShown.map((q) => (
          <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
        ))}

      <div className="spacer-v" />
      <button className="primary block center" onClick={save}>Save the night</button>
    </div>
  );
}
