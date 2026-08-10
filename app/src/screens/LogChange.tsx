import { useState } from 'react';
import { weighedVolumeMl } from '@core';
import { useStore } from '../store';
import { Topbar, OptionGroup, WhenField } from '../ui';
import { fmtVol } from '../units';
import { changesOf, wettingsOf, timeStr } from '../insights';

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

  const done = () => {
    logChange({ productId: productId || null, volumeMl, answers: fullness ? { fullness } : {}, at: at ?? undefined });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Change logged ✓" onBack={() => navigate('home')} />
      <p className="lead">Logged. Weigh it for a real volume, or just note how full — either helps the picture.</p>

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
            <label>Which product?</label>
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
        </>
      )}

      <WhenField value={at} onChange={setAt} />

      <div className="spacer-v" />
      <button className="primary block center" onClick={done}>Done</button>
    </div>
  );
}
