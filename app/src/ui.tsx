import { useState } from 'react';
import { weighedVolumeMl } from '@core';
import type { AppQuestion } from './modules';
import { useStore, type Product } from './store';
import { fmtVol, VOID_SIZES } from './units';

export function Topbar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div className="topbar">
      {onBack && (
        <button className="ghost" style={{ minHeight: 40, padding: '6px 10px' }} onClick={onBack} aria-label="Back">
          ‹
        </button>
      )}
      <h1>{title}</h1>
      <span className="spacer" />
      {right}
    </div>
  );
}

/** Single-select option chips for a question. */
export function OptionGroup({
  question,
  value,
  onChange,
}: {
  question: AppQuestion;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label>{question.prompt}</label>
      <div className="chips">
        {question.options.map((opt) => (
          <button
            key={opt}
            className={value === opt ? 'selected' : ''}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function VolumeField({
  valueMl,
  onChange,
  products = [],
}: {
  valueMl: number | null;
  onChange: (v: number | null) => void;
  products?: Product[];
}) {
  const { units, enabledModules } = useStore();
  const canWeigh = products.length > 0 && enabledModules.includes('protection');
  const [mode, setMode] = useState<'quick' | 'weigh'>('quick');
  const [productId, setProductId] = useState('');
  const [wet, setWet] = useState('');

  const sizes = VOID_SIZES[units];
  const product = products.find((p) => p.id === productId);
  const recompute = (pid: string, wetStr: string) => {
    const p = products.find((x) => x.id === pid);
    const w = Number(wetStr);
    if (p && wetStr !== '' && !Number.isNaN(w)) onChange(weighedVolumeMl(p.dryGrams, w));
  };

  return (
    <div className="field">
      <label>Volume (measured, weighed, or a rough size)</label>

      {mode === 'quick' ? (
        <>
          <div className="chips">
            {sizes.map(([label, ml]) => (
              <button key={label} className={valueMl === ml ? 'selected' : ''} onClick={() => onChange(ml)}>
                {label}
                {ml != null ? ` · ${fmtVol(ml, units)}` : ''}
              </button>
            ))}
          </div>
          {canWeigh && (
            <button className="ghost block center" onClick={() => setMode('weigh')}>
              Weigh a product instead
            </button>
          )}
        </>
      ) : (
        <>
          <div className="chips">
            {products.map((p) => (
              <button key={p.id} className={productId === p.id ? 'selected' : ''} onClick={() => { setProductId(p.id); recompute(p.id, wet); }}>
                {p.name} · dry {p.dryGrams}g
              </button>
            ))}
          </div>
          <input
            className="numinput"
            type="number"
            inputMode="numeric"
            placeholder="Wet weight (g)"
            value={wet}
            onChange={(e) => { setWet(e.target.value); recompute(productId, e.target.value); }}
          />
          {product && wet !== '' && valueMl != null && (
            <p className="note">
              {wet}g − {product.dryGrams}g = <b style={{ color: 'var(--text)' }}>{fmtVol(valueMl, units)}</b>
            </p>
          )}
          <button className="ghost block center" onClick={() => setMode('quick')}>
            Use a rough size instead
          </button>
        </>
      )}
    </div>
  );
}

/** Optional backdating: "Now" by default, or pick an earlier date/time. value in ms, null = now. */
export function WhenField({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toLocal = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return (
    <div className="field">
      <label>When</label>
      <div className="chips">
        <button className={value == null ? 'selected' : ''} onClick={() => onChange(null)}>Now</button>
        <button className={value != null ? 'selected' : ''} onClick={() => onChange(value ?? Date.now())}>Earlier…</button>
      </div>
      {value != null && (
        <input
          className="numinput"
          type="datetime-local"
          value={toLocal(value)}
          onChange={(e) => { const ms = new Date(e.target.value).getTime(); if (!Number.isNaN(ms)) onChange(ms); }}
        />
      )}
    </div>
  );
}
