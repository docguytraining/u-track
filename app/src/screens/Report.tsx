import type { ReactNode } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { voidedVolumeStats } from '@core';
import { voidsOf, leaksOf, nightsOf, changesOf, drinksOf, groupByDay, isWetNight, isDryNight, tally, share } from '../insights';
import { isCaffeine, isAlcohol } from '../modules';
import { fmtVol } from '../units';

function Card({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className="card block" onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span style={{ color: 'var(--muted)' }}>›</span>
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </button>
  );
}

const Metric = ({ n, label }: { n: ReactNode; label: string }) => (
  <div><div className="stat"><span className="n">{n}</span></div><div className="sub">{label}</div></div>
);

export function Report() {
  const { entries, enabledModules, drinkTypes, units, reports, navigate, openDetail, loadSample } = useStore();
  const voids = voidsOf(entries);
  const leaks = leaksOf(entries);
  const nights = nightsOf(entries);
  const changes = changesOf(entries);
  const drinks = drinksOf(entries);
  const has = (m: string) => enabledModules.includes(m);

  const intakeMl = drinks.reduce((s, d) => s + (d.volumeMl ?? 0), 0);
  const eveningMl = drinks.filter((d) => new Date(d.at).getHours() >= 18).reduce((s, d) => s + (d.volumeMl ?? 0), 0);
  const caffeineN = drinks.filter((d) => isCaffeine(d.type)).length;
  const alcoholN = drinks.filter((d) => isAlcohol(d.type)).length;
  const showCaffeine = drinkTypes.some(isCaffeine);
  const showAlcohol = drinkTypes.some(isAlcohol);
  const { trend, measured } = reports;

  const streamShare = share(voids, 'stream', ['Weak', 'Dribble']);
  const urgencyShare = share(voids, 'urgency', ['Strong', 'Couldn’t wait']);
  const triggers = tally(leaks, 'leakTrigger');
  const topTrigger = Object.entries(triggers).sort((a, b) => b[1] - a[1])[0];

  // Nocturia as an average per tracked night, not a raw total.
  const avgNocturia = trend.nightsTracked > 0 ? (trend.nocturiaEpisodesTotal / trend.nightsTracked).toFixed(1) : '—';
  const wetNights = nights.filter(isWetNight).length;
  const dryNights = nights.filter(isDryNight).length;
  const absorbedMl = changes.reduce((sum, c) => sum + (c.volumeMl ?? 0), 0);

  const cap = voidedVolumeStats(voids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl })));
  const qualityPct = cap.voids ? Math.round((cap.measured / cap.voids) * 100) : 0;
  const measuredDays = groupByDay(entries).filter((d) => d.night && d.voids.length > 0 && d.voids.every((v) => v.volumeMl != null)).length;

  return (
    <div className="screen">
      <Topbar title="Report" onBack={() => navigate('home')} />
      <p className="lead">Tap any card to see the data behind it.</p>

      <button className="primary block center" onClick={() => navigate('chart')}>
        📄 Frequency-volume chart · {measuredDays} of 3 measured days
      </button>
      {cap.voids > 0 && (
        <div className={qualityPct === 100 ? 'pill ok' : 'pill warn'} style={{ alignSelf: 'flex-start' }}>
          Data quality: {cap.measured} of {cap.voids} voids measured ({qualityPct}%)
        </div>
      )}

      <Card title="Bladder capacity" onClick={() => navigate('chart')}>
        <div className="grid">
          <Metric n={fmtVol(cap.maxMl, units)} label="functional (max void)" />
          <Metric n={fmtVol(cap.averageMl, units)} label="average void" />
        </div>
      </Card>

      <Card title="Activity" onClick={() => openDetail('log')}>
        <div className="grid">
          <Metric n={voids.length} label="voids" />
          <Metric n={leaks.length} label="leaks" />
          <Metric n={nights.length} label="nights" />
          <Metric n={trend.voidsPerDay ? trend.voidsPerDay.toFixed(1) : '0'} label="voids / day" />
        </div>
      </Card>

      <Card title="Fluids" onClick={() => openDetail('drinks')}>
        <div className="grid">
          <Metric n={intakeMl > 0 ? fmtVol(intakeMl, units) : '—'} label="intake today" />
          <Metric n={eveningMl > 0 ? fmtVol(eveningMl, units) : '—'} label="after 6pm" />
          {showCaffeine && <Metric n={caffeineN} label="caffeine drinks" />}
          {showAlcohol && <Metric n={alcoholN} label="alcohol drinks" />}
        </div>
      </Card>

      {(has('nocturia') || has('nightWetting') || measured) && (
        <Card title="Night & polyuria" onClick={() => openDetail('nights')}>
          <div className="grid">
            <Metric n={avgNocturia} label="nocturia / night" />
            <Metric
              n={measured?.npi.ratio != null ? `${(measured.npi.ratio * 100).toFixed(0)}%` : '—'}
              label="NPi (needs measured)"
            />
            {has('nightWetting') && <Metric n={wetNights} label="wet nights" />}
            {has('nightWetting') && <Metric n={dryNights} label="dry nights" />}
          </div>
          {measured && !measured.complete && <div className="pill warn" style={{ marginTop: 12 }}>{measured.incompleteNote}</div>}
          {measured?.npi.overThreshold && <div className="pill warn" style={{ marginTop: 12 }}>Over 33% threshold</div>}
        </Card>
      )}

      {has('protection') && (
        <Card title="Protection" onClick={() => openDetail('changes')}>
          <div className="grid">
            <Metric n={changes.length} label="changes" />
            <Metric n={absorbedMl > 0 ? fmtVol(absorbedMl, units) : '—'} label="absorbed" />
          </div>
        </Card>
      )}

      {has('bph') && (
        <Card title="Emptying / BPH" onClick={() => openDetail('bph')}>
          <div className="stat"><span className="n">{streamShare.hit}</span><span className="u">of {streamShare.of} voids weak/dribble</span></div>
        </Card>
      )}

      {has('urgency') && (
        <Card title="Urgency" onClick={() => openDetail('urgency')}>
          <div className="stat"><span className="n">{urgencyShare.hit}</span><span className="u">of {urgencyShare.of} voids strong+</span></div>
        </Card>
      )}

      {has('leakage') && (
        <Card title="Leaks" onClick={() => openDetail('leaks')}>
          <div className="stat"><span className="n">{leaks.length}</span><span className="u">{topTrigger ? `· most often: ${topTrigger[0]}` : ''}</span></div>
        </Card>
      )}

      <div className="spacer-v" />
      {entries.length === 0 && <p className="note">No data yet. Log a few events — or load a sample night below.</p>}
      <button className="ghost block center" onClick={loadSample}>Load a sample measured night</button>
    </div>
  );
}
