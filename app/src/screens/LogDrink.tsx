import { useState } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';

const SIZES: [string, number][] = [
  ['Small', 150],
  ['Cup', 250],
  ['Large', 350],
  ['Bottle', 500],
];

export function LogDrink() {
  const { drinkTypes, logDrink, navigate } = useStore();
  const [type, setType] = useState('');
  const [volumeMl, setVolumeMl] = useState<number | null>(null);

  const done = () => {
    logDrink({ type: type || 'Other', volumeMl });
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
          {SIZES.map(([label, ml]) => (
            <button key={label} className={volumeMl === ml ? 'selected' : ''} onClick={() => setVolumeMl(ml)}>
              {label} · {ml}ml
            </button>
          ))}
        </div>
      </div>

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>Done</button>
    </div>
  );
}
