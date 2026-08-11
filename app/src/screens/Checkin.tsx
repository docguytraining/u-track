import { useState } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';

/**
 * The weekly quality-of-life check-in — the "how much is this affecting you" question a
 * clinician's questionnaire ends with, captured as a trend instead of a one-off. Two
 * neutral 0–10 scales: interference (external, behavioural) and bother (the weight of it).
 * Deliberately about *interference with your life*, not "how bad do you feel" — matter of
 * fact, nothing to pass or fail.
 */
function Scale({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <>
      <p className="note" style={{ marginTop: -2 }}>0 = not at all · 10 = a great deal</p>
      <div className="chips">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} className={value === n ? 'selected' : ''} onClick={() => onChange(n)}>{n}</button>
        ))}
      </div>
    </>
  );
}

export function Checkin() {
  const { logCheckin, navigate } = useStore();
  const [interference, setInterference] = useState<number | null>(null);
  const [bother, setBother] = useState<number | null>(null);

  const done = () => {
    logCheckin({ interference: interference ?? 0, bother: bother ?? 0 });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Weekly check-in" onBack={() => navigate('home')} />
      <p className="lead">Two quick scales about the past week — this is the part of a doctor’s questionnaire that means the most as a trend over time.</p>

      <div className="field">
        <label>Over the past week, how much did your urinary symptoms get in the way of your day-to-day activities?</label>
        <Scale value={interference} onChange={setInterference} />
      </div>

      <div className="field">
        <label>And over the past week, how much did they bother you?</label>
        <Scale value={bother} onChange={setBother} />
      </div>

      <div className="spacer-v" />
      <button className="primary block center" onClick={done} disabled={interference == null && bother == null}>Save</button>
    </div>
  );
}
