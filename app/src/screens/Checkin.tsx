import { useState } from 'react';
import { useStore, type CheckIn } from '../store';
import { Topbar } from '../ui';
import { dateStr } from '../insights';

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

/** The trajectory of past check-ins — two neutral lines (interference, bother) over time.
 * A single score says little; the *slope* is what a clinician reads and what tells you
 * whether things are drifting. It only draws the shape — no "better"/"worse" verdict. */
function Trend({ checkins }: { checkins: CheckIn[] }) {
  const line = (key: 'interference' | 'bother') =>
    checkins
      .map((c, i) => `${(i / Math.max(1, checkins.length - 1)) * 100},${40 - (c[key] / 10) * 40}`)
      .join(' ');
  return (
    <div className="card">
      <h3>Your trend</h3>
      <div className="sub" style={{ marginTop: 2 }}>
        How interference and bother have moved across {checkins.length} check-in{checkins.length === 1 ? '' : 's'}.
      </div>
      {checkins.length >= 2 && (
        <svg className="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={line('interference')} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <polyline points={line('bother')} fill="none" stroke="var(--warn)" strokeWidth="1.5" strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <div className="rhythm-legend" style={{ marginTop: 8 }}>
        <span className="key"><span className="swatch" style={{ background: 'var(--accent)' }} />interference</span>
        <span className="key"><span className="swatch" style={{ background: 'var(--warn)' }} />bother</span>
      </div>
      <div className="list" style={{ marginTop: 10 }}>
        {checkins.slice(-6).reverse().map((c) => (
          <div className="logline" key={c.id}>
            <span>{dateStr(c.at)}</span>
            <b>{c.interference}/10 · {c.bother}/10</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Checkin() {
  const { logCheckin, checkins, navigate } = useStore();
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

      {checkins.length > 0 && <Trend checkins={checkins} />}

      <div className="spacer-v" />
      <button className="primary block center" onClick={done} disabled={interference == null && bother == null}>Save</button>
    </div>
  );
}
