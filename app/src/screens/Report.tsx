import { useStore } from '../store';
import { Topbar } from '../ui';

export function Report() {
  const { reports, navigate, loadSample, measuredDay } = useStore();
  const { trend, measured } = reports;

  return (
    <div className="screen">
      <Topbar title="Report" onBack={() => navigate('home')} />
      <p className="lead">What your data honestly supports — counts always, the precise numbers only when earned.</p>

      <div className="card">
        <h3>Everyday trend</h3>
        <div className="grid" style={{ marginTop: 12 }}>
          <div>
            <div className="sub">Days tracked</div>
            <div className="stat"><span className="n">{trend.days}</span></div>
          </div>
          <div>
            <div className="sub">Voids / day</div>
            <div className="stat"><span className="n">{trend.voidsPerDay ? trend.voidsPerDay.toFixed(1) : '0'}</span></div>
          </div>
          <div>
            <div className="sub">Nights tracked</div>
            <div className="stat"><span className="n">{trend.nightsTracked}</span></div>
          </div>
          <div>
            <div className="sub">Nocturia episodes</div>
            <div className="stat"><span className="n">{trend.nocturiaEpisodesTotal}</span></div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          {trend.npiAvailable ? (
            <span className="pill ok">NPi available</span>
          ) : (
            <span className="pill muted">NPi needs a full measured day</span>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Measured day</h3>
        {!measured ? (
          <p className="sub" style={{ marginTop: 8 }}>
            {measuredDay
              ? 'Log a night and some voids with volumes, and this fills in.'
              : 'Start a measured day (and log the night) to compute the nocturnal polyuria index.'}
          </p>
        ) : (
          <>
            <div className="list" style={{ marginTop: 8 }}>
              <div className="logline"><span>Nocturia episodes</span><b>{measured.nocturiaEpisodes}</b></div>
              <div className="logline"><span>Nocturnal urine volume</span><b>{measured.nuvMl == null ? 'withheld' : `${measured.nuvMl} ml`}</b></div>
              <div className="logline">
                <span>NPi (NUV ÷ 24h)</span>
                <b>{measured.npi.ratio == null ? 'withheld' : `${(measured.npi.ratio * 100).toFixed(0)}%`}</b>
              </div>
              <div className="logline"><span>Voids measured</span><b>{measured.measuredVoids} / {measured.totalVoids}</b></div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {measured.complete ? (
                <span className="pill ok">Complete window</span>
              ) : (
                <span className="pill warn">{measured.incompleteNote}</span>
              )}
              {measured.npi.overThreshold != null && (
                <span className={`pill ${measured.npi.overThreshold ? 'warn' : 'ok'}`}>
                  {measured.npi.overThreshold ? 'Over 33% threshold' : 'Under 33% threshold'}
                </span>
              )}
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              The ratio is flagged against an age-dependent threshold — it’s not a diagnosis.
            </p>
          </>
        )}
      </div>

      <div className="spacer-v" />
      <button className="ghost block center" onClick={loadSample}>
        Load a sample measured night (to see a full report)
      </button>
    </div>
  );
}
