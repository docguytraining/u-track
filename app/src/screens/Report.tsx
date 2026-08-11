import type { ReactNode } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { voidedVolumeStats } from '@core';
import { voidsOf, toiletVoidsOf, leaksOf, nightsOf, changesOf, wettingsOf, drinksOf, groupByDay, isWetNight, isDryNight, tally, share, productAdequacy, leakyProducts } from '../insights';
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
  const { entries, enabledModules, drinkTypes, units, reports, products, checkins, meds, navigate, openDetail, loadSample } = useStore();
  // Evening/bedtime medications are the ones that can shape the night numbers — surface them
  // as plain context beside nocturia, so the person (and their provider) reads the two together.
  const nightMeds = meds.filter((m) => m.timing === 'Evening' || m.timing === 'Bedtime');
  const lastCk = checkins[checkins.length - 1];
  const prevCk = checkins[checkins.length - 2];
  const voids = voidsOf(entries);
  const toiletVoids = toiletVoidsOf(entries);
  const leaks = leaksOf(entries);
  const nights = nightsOf(entries);
  const adequacy = productAdequacy(nights, products);
  const leaky = leakyProducts(adequacy);
  const changes = changesOf(entries);
  const wettings = wettingsOf(entries);
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
  // Voiding frequency is honest only when wettings-into-protection are counted alongside
  // toilet voids — each is a bladder emptying, whatever it landed in.
  const daysSpan = groupByDay(entries).length || 1;
  // Every void is one emptying (toilet, product, or escaped) — count each once.
  const emptyingsPerDay = voids.length / daysSpan;

  // Capacity/quality is about measured toilet voids only — product/leak voids carry no ml.
  const cap = voidedVolumeStats(toiletVoids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl })));
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
          <Metric n={toiletVoids.length} label="voids" />
          <Metric n={leaks.length} label="leaks" />
          {wettings.length > 0 && <Metric n={wettings.length} label="wettings" />}
          <Metric n={nights.length} label="nights" />
          <Metric n={trend.voidsPerDay ? trend.voidsPerDay.toFixed(1) : '0'} label="voids / day" />
        </div>
      </Card>

      <Card title="How it’s affecting you" onClick={() => navigate('checkin')}>
        {lastCk ? (
          <>
            <div className="grid">
              <Metric n={`${lastCk.interference}/10`} label="interference with life" />
              <Metric n={`${lastCk.bother}/10`} label="bother" />
            </div>
            {prevCk && (
              <div className="sub" style={{ marginTop: 8 }}>
                Last time: {prevCk.interference}/10 and {prevCk.bother}/10 · {checkins.length} check-ins so far.
              </div>
            )}
          </>
        ) : (
          <div className="sub">Add a weekly check-in — the trend in how much this affects your life is exactly what a doctor asks about.</div>
        )}
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
          {nightMeds.length > 0 && (
            <div className="sub" style={{ marginTop: 12 }}>
              Taken in the evening or at bedtime: {nightMeds.map((m) => `${m.name} (${m.timing.toLowerCase()})`).join(', ')}.
              Worth reading alongside the night numbers.
            </div>
          )}
        </Card>
      )}

      {has('protection') && (
        <Card title="Protection" onClick={() => openDetail('changes')}>
          <div className="grid">
            <Metric n={changes.length} label="changes" />
            <Metric n={wettings.length} label="wettings" />
            <Metric n={absorbedMl > 0 ? fmtVol(absorbedMl, units) : '—'} label="absorbed" />
          </div>
          {wettings.length > 0 && (
            <div className="sub" style={{ marginTop: 10 }}>
              {emptyingsPerDay.toFixed(1)} bladder emptyings / day counting wettings — vs{' '}
              {trend.voidsPerDay ? trend.voidsPerDay.toFixed(1) : '0'} from toilet voids alone.
            </div>
          )}
        </Card>
      )}

      {has('protection') && adequacy.length > 0 && (
        <Card title="Overnight protection" onClick={() => openDetail('nights')}>
          <div className="list">
            {adequacy.map((a) => (
              <div className="logline" key={a.productId}>
                <span>{a.name}</span>
                <b>{a.leaks > 0 ? `leaked ${a.leaks} of ${a.nights} night${a.nights > 1 ? 's' : ''}` : `held · ${a.nights} night${a.nights > 1 ? 's' : ''}`}</b>
              </div>
            ))}
          </div>
          {/* Equipping, not prescribing: the person's own numbers + words for a conversation
              with the one qualified to answer. Deliberately calm styling, never a red alert. */}
          {leaky.map((a) => (
            <div key={a.productId} className="sub" style={{ marginTop: 12, paddingLeft: 10, borderLeft: '3px solid var(--accent)' }}>
              Overnight leaks: {a.leaks} of the last {a.nights} nights with {a.name}. If it’d help, that’s worth
              raising with your provider — people often ask about higher-capacity protection or ways to cut down on leaks.
            </div>
          ))}
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
      {entries.length === 0 && (
        <p className="note">No data yet — log a few events{import.meta.env.DEV ? ' or load sample data below' : ''}.</p>
      )}
      {import.meta.env.DEV && <button className="ghost block center" onClick={loadSample}>Load a few weeks of sample data</button>}
    </div>
  );
}
