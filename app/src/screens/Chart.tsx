import { useState } from 'react';
import {
  nocturiaCount,
  nocturnalUrineVolume,
  nocturnalPolyuriaIndex,
  voidedVolumeStats,
  type VoidEvent,
} from '@core';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { groupByDay, toiletVoidsOf, changesOf, isWetNight, dateStr, timeStr } from '../insights';
import { fmtVol } from '../units';

const Row = ({ left, right }: { left: string; right: string }) => (
  <div className="logline"><span>{left}</span><b>{right}</b></div>
);

const DAY = 86_400_000;
const FRAMES: [string, number | 'all'][] = [['3 days', 3], ['7 days', 7], ['14 days', 14], ['30 days', 30], ['All', 'all']];

export function Chart() {
  const { entries, units, navigate, user } = useStore();
  const [frame, setFrame] = useState<number | 'all'>(3);
  const [details, setDetails] = useState(false);

  // window.print() is a silent no-op in a home-screen (standalone) PWA on iOS — a documented
  // WebKit limitation. Detect that mode so the button can offer a working alternative instead
  // of appearing to do nothing. Elsewhere (desktop, Android, in-browser Safari) print works.
  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);

  // Run the reports over the chosen time frame only.
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const cutoff = frame === 'all' ? 0 : startToday.getTime() - (frame - 1) * DAY;
  const inRange = entries.filter((e) => (e.kind === 'night' ? e.rising : e.at) >= cutoff);

  const days = groupByDay(inRange);
  const voids = toiletVoidsOf(inRange);
  const changes = changesOf(inRange);
  const coreVoids: VoidEvent[] = voids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl }));
  const volumeEvents: VoidEvent[] = [...coreVoids, ...changes.map((c) => ({ id: c.id, at: c.at, volumeMl: c.volumeMl }))];

  const cap = voidedVolumeStats(coreVoids);
  const qualityPct = cap.voids ? Math.round((cap.measured / cap.voids) * 100) : 0;

  const nightDays = days.filter((d) => d.night);
  const measuredDays = days.filter((d) => d.night && d.voids.length > 0 && d.voids.every((v) => v.volumeMl != null)).length;
  const nocturiaTotal = nightDays.reduce((s, d) => s + nocturiaCount(coreVoids, { bedtime: d.night!.bedtime, rising: d.night!.rising }), 0);
  const avgNoct = nightDays.length ? (nocturiaTotal / nightDays.length).toFixed(1) : '—';
  const wetNights = nightDays.filter((d) => isWetNight(d.night!)).length;
  const range = days.length ? `${dateStr(new Date(days[days.length - 1]!.day).getTime())} – ${dateStr(new Date(days[0]!.day).getTime())}` : 'no data in range';

  return (
    <div className="screen chart">
      <div className="print-hide">
        <Topbar title="Frequency-volume chart" onBack={() => navigate('report')} />
        <div className="card" style={{ marginTop: 12 }}>
          <div className="sub" style={{ marginBottom: 8 }}>Time frame</div>
          <div className="chips">
            {FRAMES.map(([label, n]) => (
              <button key={label} className={frame === n ? 'selected' : ''} onClick={() => setFrame(n)}>{label}</button>
            ))}
          </div>
          <button className={`block rowbtn ${details ? 'on selected' : ''}`} style={{ marginTop: 12 }} onClick={() => setDetails((d) => !d)}>
            <span className="check">{details ? '✓' : ''}</span>
            <span><b>Include full detail</b><div className="sub">Every void, time-stamped</div></span>
          </button>
          <button className="primary block center" style={{ marginTop: 10 }} onClick={() => window.print()}>Print / Save PDF</button>
          {standalone && (
            <p className="note" style={{ marginTop: 8 }}>
              If nothing happens, your phone is blocking Save-as-PDF inside the installed app. The
              reliable way to hand this to your doctor is <b>Copy summary</b> on the Report screen — it
              copies text you can paste into Messages, Mail or Notes — or <b>Export</b> in Settings.
              {user
                ? ' You can also open u-track in a browser and sign in — your data syncs there — then use Save as PDF.'
                : ' To print from a computer instead, make an account first (Settings → Sign in) so your data can follow you there — on this device the installed app and the browser don’t share storage.'}
            </p>
          )}
        </div>
      </div>

      <div className="print-only" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>u-track · frequency-volume chart</h2></div>
      <p className="lead">{range} · {days.length} day{days.length === 1 ? '' : 's'} · <b style={{ color: measuredDays >= 3 ? 'var(--accent)' : 'var(--warn)' }}>{measuredDays} of 3 measured days</b></p>

      <div className="card">
        <h3>Summary</h3>
        <div className="grid" style={{ marginTop: 10 }}>
          <div><div className="sub">Functional capacity</div><div className="stat"><span className="n">{fmtVol(cap.maxMl, units)}</span></div><div className="sub">max voided</div></div>
          <div><div className="sub">Average void</div><div className="stat"><span className="n">{fmtVol(cap.averageMl, units)}</span></div></div>
          <div><div className="sub">Nocturia / night</div><div className="stat"><span className="n">{avgNoct}</span></div></div>
          <div><div className="sub">Wet nights</div><div className="stat"><span className="n">{wetNights}</span></div></div>
        </div>
        <div className="hr" />
        <div className={qualityPct === 100 ? 'pill ok' : 'pill warn'}>
          Data quality: {cap.measured} of {cap.voids} voids measured ({qualityPct}%)
        </div>
      </div>

      {days.length === 0 && <p className="note">No data in this time frame — widen it, or log some events.</p>}

      {days.map((d) => {
        const dv: VoidEvent[] = d.voids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl }));
        const dayCap = voidedVolumeStats(dv);
        const intake = d.drinks.reduce((s, x) => s + (x.volumeMl ?? 0), 0);
        const sleep = d.night ? { bedtime: d.night.bedtime, rising: d.night.rising } : null;
        const npi = sleep ? nocturnalPolyuriaIndex(volumeEvents, sleep) : null;
        const nuv = sleep ? nocturnalUrineVolume(volumeEvents, sleep) : null;
        const voidedMl = dayCap.measured ? dv.map((v) => v.volumeMl ?? 0).reduce((a, b) => a + b, 0) : null;
        return (
          <div className="card" key={d.day} style={{ breakInside: 'avoid' }}>
            <h3>{dateStr(new Date(d.day).getTime())}</h3>
            <div className="list" style={{ marginTop: 8 }}>
              <Row left="Voids" right={`${d.voids.length}`} />
              <Row left="Voided volume" right={fmtVol(voidedMl, units)} />
              <Row left="Fluid intake" right={intake > 0 ? fmtVol(intake, units) : '—'} />
              {sleep && <Row left="Nocturia" right={`${nocturiaCount(coreVoids, sleep)}`} />}
              {sleep && <Row left="Nocturnal volume" right={nuv == null ? 'withheld' : fmtVol(nuv, units)} />}
              {sleep && <Row left="NPi" right={npi?.ratio == null ? 'withheld' : `${(npi.ratio * 100).toFixed(0)}%`} />}
            </div>
            {details && d.voids.length > 0 && (
              <>
                <div className="note" style={{ marginTop: 10, marginBottom: 4 }}>Voids</div>
                <div className="list">
                  {d.voids.slice().sort((a, b) => a.at - b.at).map((v) => (
                    <Row key={v.id} left={timeStr(v.at)} right={fmtVol(v.volumeMl, units)} />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      <p className="note" style={{ marginTop: 8 }}>
        u-track is a personal tracking aid, not a medical device. It does not diagnose or treat —
        share this chart with your clinician.
      </p>
    </div>
  );
}
