import { useStore } from '../store';
import { Icon } from '../icons';

export function Home() {
  const { measuredDay, setMeasuredDay, navigate, enabledModules, checkins } = useStore();
  // A gentle weekly nudge — surfaces only when it's been a week, never nags in between.
  const last = checkins[checkins.length - 1];
  const checkinDue = !last || Date.now() - last.at > 7 * 86_400_000;

  return (
    <div className="screen">
      <div className="topbar">
        <h1>Log</h1>
        <span className="spacer" />
        {measuredDay && <span className="pill ok">Measured day</span>}
        <button className="ghost" style={{ minHeight: 40, padding: '6px 12px' }} onClick={() => navigate('settings')}>
          Settings
        </button>
      </div>

      {/* Fast path: the things you tap to log, front and center. Nothing to read. */}
      <button className="big center block" onClick={() => navigate('void')}><Icon name="void" /> Void</button>
      <button className="big center block" onClick={() => navigate('drink')}><Icon name="drink" /> Drink</button>
      <button className="big center block" onClick={() => navigate('leak')}><Icon name="leak" /> Leak</button>
      {enabledModules.includes('protection') && (
        <button className="big center block" onClick={() => navigate('change')}><Icon name="change" /> Change</button>
      )}
      <button className="big center block" onClick={() => navigate('morning')}><Icon name="morning" /> Morning check-in</button>

      <div className="spacer-v" />

      {checkinDue && (
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
      </div>
    </div>
  );
}
