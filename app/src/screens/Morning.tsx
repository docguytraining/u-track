import { useState } from 'react';
import { useStore } from '../store';
import { Topbar, OptionGroup, VolumeField } from '../ui';

const BED: [string, number][] = [
  ['9pm', 21], ['10pm', 22], ['11pm', 23], ['12am', 0], ['1am', 1], ['2am', 2], ['3am', 3],
];
const RISE: [string, number][] = [
  ['5am', 5], ['6am', 6], ['7am', 7], ['8am', 8], ['9am', 9], ['10am', 10], ['11am', 11],
];

export function Morning() {
  const { coreQuestions, gatewayQuestions, logNight, navigate, products } = useStore();
  // Morning is always the full flow (spec §7.5) — all enabled morning questions.
  const questions = [...coreQuestions('morning'), ...gatewayQuestions('morning')];

  const [bedHour, setBedHour] = useState(23);
  const [riseHour, setRiseHour] = useState(7);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [firstVoidMl, setFirstVoidMl] = useState<number | null>(null);

  const save = () => {
    const rising = new Date();
    rising.setHours(riseHour, 0, 0, 0);
    const bed = new Date();
    // Evening bedtimes belong to the night before; after-midnight ones (12am–3am)
    // are this same morning, before rising — so a 2am bedtime keys to the right night.
    if (bedHour >= 18) bed.setDate(bed.getDate() - 1);
    bed.setHours(bedHour, 0, 0, 0);
    logNight({ bedtime: bed.getTime(), rising: rising.getTime(), firstVoidVolumeMl: firstVoidMl, answers });
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
      </div>

      {questions.map((q) => (
        <OptionGroup key={q.id} question={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
      ))}

      <div className="hr" />
      <div className="field">
        <label>First morning void</label>
        <p className="note" style={{ marginTop: -2 }}>The single most useful number in the whole chart.</p>
        <VolumeField valueMl={firstVoidMl} onChange={setFirstVoidMl} products={products} />
      </div>

      <div className="spacer-v" />
      <button className="primary block center" onClick={save}>Save the night</button>
    </div>
  );
}
