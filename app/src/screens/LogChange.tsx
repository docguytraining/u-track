import { useState } from 'react';
import { weighedVolumeMl } from '@core';
import { useStore } from '../store';
import { Topbar, OptionGroup, WhenField } from '../ui';
import { fmtVol } from '../units';
import { changesOf, wettingsOf, timeStr } from '../insights';

const H = 3_600_000;
// Wear-time buckets. The default guess never exceeds 12h — beyond that a gap almost always means
// a missed change, not a real wear — but "More than 12h" is here to pick by hand if it truly was.
const WEAR: { label: string; h: number }[] = [
  { label: 'Under 2h', h: 1 },
  { label: '2–4h', h: 3 },
  { label: '4–8h', h: 6 },
  { label: '8–12h', h: 10 },
  { label: 'More than 12h', h: 16 },
];
/** Bucket index for a duration in hours, never auto-landing past the 12h cap (index 3). */
const wearIdxFor = (hours: number) => { const h = Math.min(hours, 12); return h < 2 ? 0 : h < 4 ? 1 : h < 8 ? 2 : 3; };

export function LogChange() {
  const { products, units, logChange, navigate, entries } = useStore();
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [wet, setWet] = useState('');
  const [fullness, setFullness] = useState('');
  const [at, setAt] = useState<number | null>(null);

  const product = products.find((p) => p.id === productId);
  const wetNum = Number(wet);
  const volumeMl = product && wet !== '' && !Number.isNaN(wetNum) ? weighedVolumeMl(product.dryGrams, wetNum) : null;

  // Wettings logged since the last change are already soaked into this product, so the
  // wet weight below covers them. They stay volume-less on their own (counted for
  // frequency) precisely so this weight isn't double-counted.
  const lastChangeAt = changesOf(entries).reduce((m, c) => Math.max(m, c.at), 0);
  const wettingsSince = wettingsOf(entries).filter((w) => w.at > lastChangeAt);

  // Wear time only matters when the product came back with something in it — a bone-dry change
  // over any span isn't a signal. Default to the (capped) gap since the last change.
  const gapH = lastChangeAt ? (Date.now() - lastChangeAt) / H : null;
  const overCap = gapH != null && gapH > 12;
  const [wearIdx, setWearIdx] = useState(gapH != null ? wearIdxFor(gapH) : 2);
  const hasAbsorption = volumeMl != null || ['Moderate', 'Heavy', 'Saturated'].includes(fullness);

  const done = () => {
    logChange({
      productId: productId || null,
      volumeMl,
      answers: fullness ? { fullness } : {},
      at: at ?? undefined,
      wearMs: hasAbsorption ? WEAR[wearIdx]!.h * H : undefined,
    });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Log a change" onBack={() => navigate('home')} />
      <p className="lead">Weigh it for a real volume, or just note how full — then tap Done.</p>

      {wettingsSince.length > 0 && (
        <p className="note">
          {wettingsSince.length} wetting{wettingsSince.length > 1 ? 's' : ''} since your last change
          ({wettingsSince.map((w) => timeStr(w.at)).join(', ')}). The wet weight already includes
          {wettingsSince.length > 1 ? ' them' : ' it'} — they’re counted toward how often you go, not
          added to volume again, so nothing is double-counted.
        </p>
      )}

      {products.length === 0 ? (
        <p className="note">Add a product in Settings first, so a change can be weighed.</p>
      ) : (
        <>
          <div className="field">
            <label>Which product did you remove?</label>
            <div className="chips">
              {products.map((p) => (
                <button key={p.id} className={productId === p.id ? 'selected' : ''} onClick={() => setProductId(p.id)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Wet weight (g) — optional</label>
            <input
              className="numinput"
              type="number"
              inputMode="numeric"
              placeholder={`Dry is ${product?.dryGrams ?? '?'}g`}
              value={wet}
              onChange={(e) => setWet(e.target.value)}
            />
            {volumeMl != null && (
              <p className="note">{wet}g − {product!.dryGrams}g = <b style={{ color: 'var(--text)' }}>{fmtVol(volumeMl, units)}</b> absorbed</p>
            )}
          </div>

          <OptionGroup
            question={{ id: 'fullness', surface: 'leak', coreEligible: false, priority: 0, prompt: 'Or — how full did it feel?', options: ['Light', 'Moderate', 'Heavy', 'Saturated'] }}
            value={fullness}
            onChange={setFullness}
          />

          {hasAbsorption && (
            <div className="field">
              <label>How long were you wearing it?</label>
              <div className="chips">
                {WEAR.map((w, i) => (
                  <button key={w.label} className={wearIdx === i ? 'selected' : ''} onClick={() => setWearIdx(i)}>{w.label}</button>
                ))}
              </div>
              {overCap && <p className="note">It’s been over 12h since your last logged change — we’ll assume 12h unless you set it. Did a change go unlogged?</p>}
            </div>
          )}
        </>
      )}

      <WhenField value={at} onChange={setAt} />

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>Done</button>
    </div>
  );
}
