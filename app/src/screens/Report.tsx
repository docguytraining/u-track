import { useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { buildClinicalSummary } from '../summary';
import { voidedVolumeStats } from '@core';
import { voidsOf, toiletVoidsOf, leaksOf, nightsOf, changesOf, wettingsOf, incontinenceEpisodesOf, drinksOf, groupByDay, isWetNight, isDryNight, tally, share, productAdequacy, leakyProducts, hourlyRhythm, surgePatterns, minuteOfDayStr, SURGE_THRESHOLD_ML, type HourBucket, type SurgePattern } from '../insights';
import { isCaffeine, isAlcohol } from '../modules';
import { fmtVol } from '../units';
import { Icon } from '../icons';

function Card({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button className="card block" onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span style={{ color: 'var(--muted)' }} aria-hidden="true">›</span>
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </button>
  );
}

const Metric = ({ n, label }: { n: ReactNode; label: string }) => (
  <div><div className="stat"><span className="n">{n}</span></div><div className="sub">{label}</div></div>
);

// 13 → "1pm", 0 → "12am" — for naming the busiest hour in plain language.
const fmtHour = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;

/** A 24-hour clock of when voids and leaks happen, folded across every logged day. It answers
 * "when does it happen?" — the pattern a clinician asks about — and nothing more. No target,
 * no judgment: it just draws the shape of the day. */
function RhythmCard({ buckets, days, total, peak }: { buckets: HourBucket[]; days: number; total: number; peak: HourBucket | null }) {
  const max = Math.max(1, ...buckets.map((b) => b.voids + b.leaks));
  const anyLeak = buckets.some((b) => b.leaks > 0);
  return (
    <div className="card">
      <h3>Daily rhythm</h3>
      <div className="sub" style={{ marginTop: 2 }}>
        When voids and leaks tend to happen, across {days} day{days === 1 ? '' : 's'}.
      </div>
      <div className="rhythm" aria-hidden="true">
        {buckets.map((b) => {
          const sum = b.voids + b.leaks;
          if (sum === 0) return <div className="col empty" key={b.hour} />;
          return (
            <div className="col" key={b.hour} title={`${fmtHour(b.hour)}: ${b.voids} void${b.voids === 1 ? '' : 's'}${b.leaks ? `, ${b.leaks} leak${b.leaks === 1 ? '' : 's'}` : ''}`}>
              {b.leaks > 0 && <div className="seg leak" style={{ height: `${(b.leaks / max) * 100}%` }} />}
              {b.voids > 0 && <div className="seg void" style={{ height: `${(b.voids / max) * 100}%` }} />}
            </div>
          );
        })}
      </div>
      {/* The bars are aria-hidden (not semantic); this is the same data as text for screen readers. */}
      <p className="sr-only">
        Voids and leaks by hour of day:{' '}
        {buckets.filter((b) => b.voids + b.leaks > 0).map((b) =>
          `${fmtHour(b.hour)} ${b.voids} void${b.voids === 1 ? '' : 's'}${b.leaks ? `, ${b.leaks} leak${b.leaks === 1 ? '' : 's'}` : ''}`,
        ).join('; ')}.
      </p>
      <div className="rhythm-axis"><span>12am</span><span>6am</span><span>noon</span><span>6pm</span><span>12am</span></div>
      <div className="rhythm-legend">
        <span className="key"><span className="swatch" style={{ background: 'var(--accent)' }} />voids</span>
        {anyLeak && <span className="key"><span className="swatch" style={{ background: 'var(--warn)' }} />leaks</span>}
      </div>
      {peak && total >= 5 && (
        <div className="sub" style={{ marginTop: 10 }}>
          Busiest around {fmtHour(peak.hour)}–{fmtHour((peak.hour + 1) % 24)}.
          {peak.hour >= 22 || peak.hour < 6 ? ' Overnight clustering is worth mentioning to your provider.' : ''}
        </div>
      )}
    </div>
  );
}

/** Recurring high-volume episodes at a consistent time of day. Descriptive, not a diagnosis —
 * the copy points the person at their provider, matching the rhythm card's voice. */
function SurgeCard({ patterns }: { patterns: SurgePattern[] }) {
  const isOvernight = (min: number) => { const h = Math.floor(min / 60); return h >= 22 || h < 6; };
  const anyEstimated = patterns.some((p) => p.estimated);
  return (
    <div className="card">
      <h3>High-volume episodes</h3>
      <div className="sub" style={{ marginTop: 2 }}>
        A lot passed in a short time (≥{SURGE_THRESHOLD_ML} mL within ~2 hours), recurring at the same time of day.
      </div>
      <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
        {patterns.map((p, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            Around <b>{minuteOfDayStr(p.minuteOfDay)}</b> on <b>{p.days}</b> of {p.periodDays} tracked days
            {isOvernight(p.minuteOfDay) ? ' — overnight; worth mentioning to your provider' : ''}.
          </li>
        ))}
      </ul>
      {anyEstimated && (
        <div className="sub" style={{ marginTop: 8 }}>
          Some volumes are estimated from the size you reported, not measured — log a few measured days for firmer numbers.
        </div>
      )}
    </div>
  );
}

export function Report() {
  const { entries, enabledModules, drinkTypes, units, reports, products, checkins, meds, navigate, openDetail, loadSample } = useStore();
  // Evening/bedtime medications are the ones that can shape the night numbers — surface them
  // as plain context beside nocturia, so the person (and their provider) reads the two together.
  const nightMeds = meds.filter((m) => m.timing === 'Evening' || m.timing === 'Bedtime');
  const lastCk = checkins[checkins.length - 1];
  const prevCk = checkins[checkins.length - 2];
  const voids = voidsOf(entries);
  const toiletVoids = toiletVoidsOf(entries);
  const leaks = leaksOf(entries); // escaped onto clothing/bed — the containment-breach subset
  const episodes = incontinenceEpisodesOf(entries); // all involuntary loss (escaped + into product)
  const nights = nightsOf(entries);
  const adequacy = productAdequacy(nights, products);
  const leaky = leakyProducts(adequacy);
  const changes = changesOf(entries);
  const wettings = wettingsOf(entries);
  const drinks = drinksOf(entries);
  const rhythm = hourlyRhythm(entries);
  const surges = surgePatterns(entries);
  const has = (m: string) => enabledModules.includes(m);

  // A paste-able plain-text summary for a patient-portal message or a phone call with a
  // nurse — the gap between the raw CSV and the printable chart.
  const [copied, setCopied] = useState(false);
  const copySummary = () => {
    const text = buildClinicalSummary(entries, checkins, meds, products, units);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

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

  // Before there's any data, don't show a wall of zeros — show what will happen and where
  // to start. Matter-of-fact and encouraging, per the app's no-judgment voice.
  if (entries.length === 0) {
    return (
      <div className="screen">
        <Topbar title="Report" onBack={() => navigate('home')} />
        <div className="card" style={{ textAlign: 'center', padding: '28px 18px' }}>
          <h3 style={{ marginBottom: 8 }}>Nothing logged yet</h3>
          <p className="sub">
            Log a void, drink, or leak from the home screen. After a day or two this fills in with your
            patterns — and a frequency-volume chart you can hand to your doctor.
          </p>
        </div>
        <button className="primary block center" onClick={() => navigate('home')}>Go to the log</button>
        {import.meta.env.DEV && <button className="ghost block center" onClick={loadSample}>Load a few weeks of sample data</button>}
      </div>
    );
  }

  return (
    <div className="screen">
      <Topbar title="Report" onBack={() => navigate('home')} />
      <p className="lead">Tap any card to see the data behind it.</p>

      <button className="primary block center" onClick={() => navigate('chart')}>
        <Icon name="chart" size={18} /> Frequency-volume chart · {measuredDays} of 3 measured days
      </button>
      {entries.length > 0 && (
        <button className="ghost block center" onClick={copySummary}>
          {copied ? 'Copied — paste into a message to your doctor' : <><Icon name="copy" size={18} /> Copy summary for your doctor</>}
        </button>
      )}
      <span className="sr-only" role="status">{copied ? 'Summary copied to clipboard.' : ''}</span>
      {cap.voids > 0 && (
        <div className={qualityPct === 100 ? 'pill ok' : 'pill warn'} style={{ alignSelf: 'flex-start' }}>
          Data quality: {cap.measured} of {cap.voids} voids measured ({qualityPct}%)
        </div>
      )}

      <Card title="Bladder capacity" onClick={() => navigate('chart')}>
        <div className="grid">
          <Metric n={fmtVol(cap.maxMl, units)} label="largest void" />
          <Metric n={fmtVol(cap.averageMl, units)} label="average void" />
        </div>
        <div className="sub" style={{ marginTop: 10 }}>
          Your largest single void is the closest everyday sign of how much your bladder comfortably holds
          (clinicians call it functional capacity).
        </div>
      </Card>

      <Card title="Activity" onClick={() => openDetail('log')}>
        <div className="grid">
          <Metric n={toiletVoids.length} label="voids" />
          <Metric n={episodes.length} label="leaks" />
          <Metric n={nights.length} label="nights" />
          <Metric n={trend.voidsPerDay ? trend.voidsPerDay.toFixed(1) : '0'} label="voids / day" />
        </div>
      </Card>

      {rhythm.total >= 3 && <RhythmCard {...rhythm} />}
      {surges.length > 0 && <SurgeCard patterns={surges} />}

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
          <div className="sub" style={{ marginTop: 10 }}>
            NPi (nocturnal polyuria index) is the share of your whole day’s urine your body makes overnight.
            Above about a third (33%) is worth asking your doctor about — on its own it doesn’t mean anything is wrong.
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
            <Metric n={wettings.length} label="into product" />
            <Metric n={absorbedMl > 0 ? fmtVol(absorbedMl, units) : '—'} label="absorbed" />
          </div>
          {wettings.length > 0 && (
            <div className="sub" style={{ marginTop: 10 }}>
              {emptyingsPerDay.toFixed(1)} bladder emptyings / day counting leaks into protection — vs{' '}
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
