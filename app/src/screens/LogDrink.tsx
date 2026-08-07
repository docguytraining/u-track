import { useState } from 'react';
import { useStore } from '../store';
import { Topbar, WhenField } from '../ui';
import { fmtVol, DRINK_SIZES, ML_PER_OZ } from '../units';

export function LogDrink() {
  const { drinkTypes, units, logDrink, navigate } = useStore();
  const [type, setType] = useState('');
  const [volumeMl, setVolumeMl] = useState<number | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom] = useState('');
  const [at, setAt] = useState<number | null>(null);
  const sizes = DRINK_SIZES[units];
  const toMl = (n: number) => (units === 'oz' ? n * ML_PER_OZ : n);

  const done = () => {
    logDrink({ type: type || 'Other', volumeMl, at: at ?? undefined });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Drink logged ✓" onBack={() => navigate('home')} />
      <p className="lead">The input side of the chart — evening and caffeine timing matter for nights.</p>

      <div className="field">
        <label>What did you drink?</label>
        <div className="chips">
          {drinkTypes.map((t) => (
            <button key={t} className={type === t ? 'selected' : ''} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>How much?</label>
        <div className="chips">
          {sizes.map((ml) => (
            <button key={ml} className={!customMode && volumeMl === ml ? 'selected' : ''} onClick={() => { setCustomMode(false); setVolumeMl(ml); }}>
              {fmtVol(ml, units)}
            </button>
          ))}
          <button className={customMode ? 'selected' : ''} onClick={() => { setCustomMode(true); setVolumeMl(null); }}>Custom…</button>
        </div>
        {customMode && (
          <input
            className="numinput"
            type="number"
            inputMode="numeric"
            placeholder={`Amount in ${units}`}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Number(e.target.value);
              setVolumeMl(e.target.value !== '' && !Number.isNaN(n) ? Math.round(toMl(n)) : null);
            }}
          />
        )}
      </div>

      <WhenField value={at} onChange={setAt} />

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>Done</button>
    </div>
  );
}
