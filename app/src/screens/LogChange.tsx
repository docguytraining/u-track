import { useState } from 'react';
import { weighedVolumeMl } from '@core';
import { useStore } from '../store';
import { Topbar, OptionGroup, WhenField } from '../ui';
import { fmtVol } from '../units';

export function LogChange() {
  const { products, units, logChange, navigate } = useStore();
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [wet, setWet] = useState('');
  const [fullness, setFullness] = useState('');
  const [at, setAt] = useState<number | null>(null);

  const product = products.find((p) => p.id === productId);
  const wetNum = Number(wet);
  const volumeMl = product && wet !== '' && !Number.isNaN(wetNum) ? weighedVolumeMl(product.dryGrams, wetNum) : null;

  const done = () => {
    logChange({ productId: productId || null, volumeMl, answers: fullness ? { fullness } : {}, at: at ?? undefined });
    navigate('home');
  };

  return (
    <div className="screen">
      <Topbar title="Change logged ✓" onBack={() => navigate('home')} />
      <p className="lead">Logged. Weigh it for a real volume, or just note how full — either helps the picture.</p>

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
