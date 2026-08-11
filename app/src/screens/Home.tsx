import { useEffect } from 'react';
import { useStore } from '../store';
import { Icon } from '../icons';

export function Home() {
  const { measuredDay, setMeasuredDay, navigate, enabledModules, checkins, entries, notice, dismissNotice } = useStore();
  // A gentle weekly nudge — surfaces only when it's been a week, never nags in between.
  const last = checkins[checkins.length - 1];
  const checkinDue = !last || Date.now() - last.at > 7 * 86_400_000;
  const firstRun = entries.length === 0;

  // A just-logged confirmation, shown briefly then cleared — so a save never feels silent.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismissNotice, 2200);
    return () => clearTimeout(t);
  }, [notice, dismissNotice]);

  return (
    <div className="screen">
      <div className="topbar">
        <h1>u-track</h1>
        <span className="spacer" />
        {notice && <span className="pill ok" role="status">✓ {notice}</span>}
        {measuredDay && !notice && <span className="pill ok">Measured day</span>}
        <button className="ghost" style={{ minHeight: 44, padding: '6px 12px' }} onClick={() => navigate('settings')}>
          Settings
        </button>
      </div>

      {/* One-time orientation for a brand-new user; disappears the moment anything is logged. */}
      {firstRun && (
        <p className="lead">
          Tap one each time it happens — even a few taps a day builds a picture. Your Report turns it
          into something you can hand your doctor.
        </p>
      )}

      {/* Fast path: the moment-to-moment actions, front and center. Nothing to read. */}
      <button className="big center block" onClick={() => navigate('void')}><Icon name="void" /> Void</button>
      <button className="big center block" onClick={() => navigate('drink')}><Icon name="drink" /> Drink</button>
      <button className="big center block" onClick={() => navigate('leak')}><Icon name="leak" /> Leak</button>
      {enabledModules.includes('protection') && (
        <button className="big center block" onClick={() => navigate('change')}><Icon name="change" /> Change</button>
      )}
      {/* An end-of-day summary action, not a live log — a visual tier down from the buttons above. */}
      <button className="big center block ghost" onClick={() => navigate('morning')}><Icon name="morning" /> Morning check-in</button>

      <div className="spacer-v" />

      {checkinDue && !firstRun && (
        <button className="ghost block center" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => navigate('checkin')}>
          Weekly check-in — how’s it affecting you?
        </button>
      )}

      {/* Everything else is out of the way. */}
      <div className="footer-actions">
        <button className="ghost block center" onClick={() => navigate('report')}>Report</button>
        <button className="ghost block center" onClick={() => setMeasuredDay(!measuredDay)}>
          {measuredDay ? 'End measured day' : 'Start a measured day'}
        </button>
        {measuredDay && (
          <p className="note" style={{ textAlign: 'center', margin: '2px 6px 0' }}>
            Measured day on — jot a volume for each void (a measuring cup, or weigh your protection).
            Three measured days gives your doctor a proper frequency-volume chart.
          </p>
        )}
      </div>
    </div>
  );
}
