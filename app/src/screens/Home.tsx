import { useStore } from '../store';

export function Home() {
  const { measuredDay, setMeasuredDay, navigate, enabledModules } = useStore();

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
      <button className="big center block" onClick={() => navigate('void')}>🚽&nbsp; Void</button>
      <button className="big center block" onClick={() => navigate('leak')}>💧&nbsp; Leak</button>
      {enabledModules.includes('protection') && (
        <button className="big center block" onClick={() => navigate('change')}>🩲&nbsp; Change</button>
      )}
      <button className="big center block" onClick={() => navigate('morning')}>🌙&nbsp; Morning check-in</button>

      <div className="spacer-v" />

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
