import {
  classifyVoid,
  nocturiaCount,
  nocturnalUrineVolume,
  nocturnalPolyuriaIndex,
  sleepDurationMs,
  type VoidEvent,
} from '@core';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { voidsOf, leaksOf, nightsOf, changesOf, wettingsOf, drinksOf, timeStr, dateStr, durationStr, dayKey } from '../insights';
import { fmtVol } from '../units';
import { Icon, type IconName } from '../icons';

const Row = ({ left, right }: { left: React.ReactNode; right: string }) => (
  <div className="logline"><span>{left}</span><b>{right}</b></div>
);

/** An event glyph + time, so the diary log speaks the same icon language as the Home buttons. */
const Stamp = ({ icon, at }: { icon: IconName; at: number }) => (
  <><Icon name={icon} size={16} /> {timeStr(at)}</>
);

const ans = (a: Record<string, string>, keys: string[]) =>
  keys.map((k) => a[k]).filter(Boolean).join(' · ') || '—';


export function Detail() {
  const { detail, entries, navigate, products, units } = useStore();
  const voids = voidsOf(entries);
  const leaks = leaksOf(entries);
  const nights = nightsOf(entries);
  const changes = changesOf(entries);
  const wettings = wettingsOf(entries);
  const drinks = drinksOf(entries);
  const productName = (pid: string | null) => products.find((p) => p.id === pid)?.name ?? 'product';
  const vol = (ml: number | null | undefined) => (ml == null ? 'no volume' : fmtVol(ml, units));
  const coreVoids: VoidEvent[] = voids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl }));

  const back = () => navigate('report');

  const title =
    detail === 'log' ? 'All events'
    : detail === 'nights' ? 'Nights'
    : detail === 'bph' ? 'Emptying detail'
    : detail === 'urgency' ? 'Urgency detail'
    : detail === 'leaks' ? 'Leaks'
    : detail === 'changes' ? 'Protection'
    : detail === 'drinks' ? 'Fluid intake'
    : 'Detail';

  let body: React.ReactNode;

  if (detail === 'log') {
    const sorted = [...entries].sort((a, b) => (b.kind === 'night' ? b.bedtime : b.at) - (a.kind === 'night' ? a.bedtime : a.at));
    body = (
      <div className="list">
        {sorted.length === 0 && <p className="note">Nothing logged yet.</p>}
        {sorted.map((e) => {
          // Every entry kind renders here — the diary log mixes them all. Missing a kind
          // (e.g. treating a drink, which has no `answers`, as a night) throws and blanks
          // the whole screen, so this switch stays exhaustive.
          switch (e.kind) {
            case 'void':
              return <Row key={e.id} left={<Stamp icon="void" at={e.at} />} right={`${vol(e.volumeMl)}${ans(e.answers, ['urgency', 'stream']) !== '—' ? ` · ${ans(e.answers, ['urgency', 'stream'])}` : ''}`} />;
            case 'leak':
              return <Row key={e.id} left={<Stamp icon="leak" at={e.at} />} right={ans(e.answers, ['leakSeverity', 'leakTrigger'])} />;
            case 'change':
              return <Row key={e.id} left={<><Stamp icon="change" at={e.at} /> · {productName(e.productId)}</>} right={e.volumeMl != null ? vol(e.volumeMl) : ans(e.answers, ['fullness'])} />;
            case 'wetting':
              return <Row key={e.id} left={<><Stamp icon="wet" at={e.at} />{e.productId ? <> · {productName(e.productId)}</> : null}</>} right={ans(e.answers, ['leakSeverity', 'leakTrigger'])} />;
            case 'drink':
              return <Row key={e.id} left={<><Stamp icon="drink" at={e.at} /> · {e.type}</>} right={vol(e.volumeMl)} />;
            case 'night':
              return <Row key={e.id} left={<><Icon name="morning" size={16} /> {dateStr(e.bedtime)}</>} right={ans(e.answers, ['howWasNight', 'wetDry'])} />;
          }
        })}
      </div>
    );
  } else if (detail === 'nights') {
    body = (
      <div className="list" style={{ gap: 14 }}>
        {nights.length === 0 && <p className="note">No nights logged. Use the morning check-in.</p>}
        {nights
          .slice()
          .sort((a, b) => b.bedtime - a.bedtime)
          .map((n) => {
            const sleep = { bedtime: n.bedtime, rising: n.rising };
            const npi = nocturnalPolyuriaIndex(coreVoids, sleep);
            const nuv = nocturnalUrineVolume(coreVoids, sleep);
            const contributing = coreVoids.filter((v) => {
              const c = classifyVoid(v, sleep, coreVoids);
              return c === 'nocturnal' || c === 'first-morning';
            });
            return (
              <div className="card" key={n.id}>
                <h3>{dateStr(n.bedtime)} night</h3>
                <div className="sub">{timeStr(n.bedtime)} → {timeStr(n.rising)} · {durationStr(sleepDurationMs(sleep))} asleep</div>
                <div className="list" style={{ marginTop: 10 }}>
                  <Row left="Nocturia — logged voids" right={String(nocturiaCount(coreVoids, sleep))} />
                  {n.answers.nightVoids && <Row left="Nocturia — you reported" right={n.answers.nightVoids} />}
                  <Row left="Nocturnal urine volume" right={nuv == null ? 'withheld' : fmtVol(nuv, units)} />
                  <Row left="NPi (NUV ÷ 24h)" right={npi.ratio == null ? 'withheld' : `${(npi.ratio * 100).toFixed(0)}%`} />
                  {(n.answers.howWasNight || n.answers.wetDry) && (
                    <Row left="Morning" right={ans(n.answers, ['howWasNight', 'wetDry'])} />
                  )}
                </div>
                {contributing.length > 0 && (
                  <>
                    <div className="note" style={{ marginTop: 12, marginBottom: 4 }}>Contributing voids</div>
                    <div className="list">
                      {contributing.map((v) => (
                        <Row key={v.id} left={`${timeStr(v.at)} · ${classifyVoid(v, sleep, coreVoids)}`} right={vol(v.volumeMl)} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
    );
  } else if (detail === 'bph') {
    const bphKeys = ['stream', 'hesitancy', 'strainInit', 'strainHold', 'intermittency', 'dribble', 'incomplete'];
    const withBph = voids.filter((v) => bphKeys.some((k) => v.answers[k]));
    body = (
      <div className="list">
        {withBph.length === 0 && <p className="note">No voids with emptying detail yet.</p>}
        {withBph.map((v) => (
          <Row key={v.id} left={timeStr(v.at)} right={ans(v.answers, bphKeys)} />
        ))}
      </div>
    );
  } else if (detail === 'urgency') {
    const withU = voids.filter((v) => v.answers.urgency);
    body = (
      <div className="list">
        {withU.length === 0 && <p className="note">No urgency logged yet.</p>}
        {withU.map((v) => <Row key={v.id} left={timeStr(v.at)} right={v.answers.urgency!} />)}
      </div>
    );
  } else if (detail === 'leaks') {
    body = (
      <div className="list">
        {leaks.length === 0 && <p className="note">No leaks logged.</p>}
        {leaks.map((l) => (
          <Row key={l.id} left={timeStr(l.at)} right={ans(l.answers, ['leakSeverity', 'leakTrigger', 'leakAwareness'])} />
        ))}
      </div>
    );
  } else if (detail === 'changes') {
    const changeDays = new Set(changes.map((c) => dayKey(c.at))).size || 1;
    const byProduct = new Map<string | null, number>();
    for (const c of changes) byProduct.set(c.productId, (byProduct.get(c.productId) ?? 0) + 1);
    body = (
      <>
        {changes.length > 0 && (
          <div className="card">
            <h3>Used per day</h3>
            <div className="sub">Over {changeDays} day{changeDays > 1 ? 's' : ''} — for restocking.</div>
            <div className="list" style={{ marginTop: 8 }}>
              {[...byProduct.entries()].map(([pid, count]) => (
                <Row key={pid ?? 'unknown'} left={productName(pid)} right={`${(count / changeDays).toFixed(1)} / day`} />
              ))}
            </div>
          </div>
        )}
        <div className="note" style={{ marginTop: 4, marginBottom: 4 }}>Changes</div>
        <div className="list">
          {changes.length === 0 && <p className="note">No changes logged.</p>}
          {changes
            .slice()
            .sort((a, b) => b.at - a.at)
            .map((c) => (
              <Row
                key={c.id}
                left={`${timeStr(c.at)} · ${productName(c.productId)}`}
                right={c.volumeMl != null ? fmtVol(c.volumeMl, units) : c.answers.fullness ?? '—'}
              />
            ))}
        </div>

        {wettings.length > 0 && (
          <>
            <div className="note" style={{ marginTop: 14, marginBottom: 4 }}>
              Wettings between changes — counted in voiding frequency, not volume
            </div>
            <div className="list">
              {wettings
                .slice()
                .sort((a, b) => b.at - a.at)
                .map((w) => (
                  <Row
                    key={w.id}
                    left={`${dateStr(w.at)} ${timeStr(w.at)}`}
                    right={ans(w.answers, ['leakSeverity', 'leakTrigger'])}
                  />
                ))}
            </div>
          </>
        )}
      </>
    );
  } else if (detail === 'drinks') {
    body = (
      <div className="list">
        {drinks.length === 0 && <p className="note">No drinks logged.</p>}
        {drinks
          .slice()
          .sort((a, b) => b.at - a.at)
          .map((d) => (
            <Row key={d.id} left={`${timeStr(d.at)} · ${d.type}`} right={fmtVol(d.volumeMl, units)} />
          ))}
      </div>
    );
  } else {
    body = <p className="note">Nothing to show.</p>;
  }

  return (
    <div className="screen">
      <Topbar title={title} onBack={back} />
      {body}
    </div>
  );
}
