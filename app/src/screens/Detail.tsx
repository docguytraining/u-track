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
import { voidsOf, leaksOf, nightsOf, timeStr, dateStr, durationStr } from '../insights';

const Row = ({ left, right }: { left: string; right: string }) => (
  <div className="logline"><span>{left}</span><b>{right}</b></div>
);

const ans = (a: Record<string, string>, keys: string[]) =>
  keys.map((k) => a[k]).filter(Boolean).join(' · ') || '—';

const vol = (ml: number | null) => (ml == null ? 'no volume' : `${ml} ml`);

export function Detail() {
  const { detail, entries, navigate } = useStore();
  const voids = voidsOf(entries);
  const leaks = leaksOf(entries);
  const nights = nightsOf(entries);
  const coreVoids: VoidEvent[] = voids.map((v) => ({ id: v.id, at: v.at, volumeMl: v.volumeMl }));

  const back = () => navigate('report');

  const title =
    detail === 'log' ? 'All events'
    : detail === 'nights' ? 'Nights'
    : detail === 'bph' ? 'Emptying detail'
    : detail === 'urgency' ? 'Urgency detail'
    : detail === 'leaks' ? 'Leaks'
    : 'Detail';

  let body: React.ReactNode;

  if (detail === 'log') {
    const sorted = [...entries].sort((a, b) => (b.kind === 'night' ? b.bedtime : b.at) - (a.kind === 'night' ? a.bedtime : a.at));
    body = (
      <div className="list">
        {sorted.length === 0 && <p className="note">Nothing logged yet.</p>}
        {sorted.map((e) =>
          e.kind === 'void' ? (
            <Row key={e.id} left={`🚽 ${timeStr(e.at)}`} right={`${vol(e.volumeMl)}${ans(e.answers, ['urgency', 'stream']) !== '—' ? ` · ${ans(e.answers, ['urgency', 'stream'])}` : ''}`} />
          ) : e.kind === 'leak' ? (
            <Row key={e.id} left={`💧 ${timeStr(e.at)}`} right={ans(e.answers, ['leakSeverity', 'leakTrigger'])} />
          ) : (
            <Row key={e.id} left={`🌙 ${dateStr(e.bedtime)}`} right={ans(e.answers, ['howWasNight', 'wetDry'])} />
          ),
        )}
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
                  <Row left="Nocturia episodes" right={String(nocturiaCount(coreVoids, sleep))} />
                  <Row left="Nocturnal urine volume" right={nuv == null ? 'withheld' : `${nuv} ml`} />
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
