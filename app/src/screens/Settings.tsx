import { useState } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { MODULES } from '../modules';

export function Settings() {
  const { enabledModules, traits, products, entries, navigate, reset, loadSample, rerunOnboarding, addProduct, removeProduct } = useStore();
  const [name, setName] = useState('');
  const [dry, setDry] = useState('');

  const add = () => {
    const g = Number(dry);
    if (name.trim() && dry !== '' && !Number.isNaN(g)) {
      addProduct(name.trim(), g);
      setName('');
      setDry('');
    }
  };

  return (
    <div className="screen">
      <Topbar title="Settings" onBack={() => navigate('home')} />

      <div className="card">
        <h3>Tracking modules</h3>
        <div className="list" style={{ marginTop: 8 }}>
          {enabledModules.length === 0 && <div className="sub">None enabled.</div>}
          {enabledModules.map((m) => (
            <div className="logline" key={m}><span>{MODULES[m]?.label ?? m}</span><b>on</b></div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 10 }}>Re-running onboarding edits these and never deletes logged events.</p>
      </div>

      {Object.keys(traits).length > 0 && (
        <div className="card">
          <h3>Traits</h3>
          <div className="list" style={{ marginTop: 8 }}>
            {Object.entries(traits).map(([k, v]) => (
              <div className="logline" key={k}><span>{k}</span><b>{String(v)}</b></div>
            ))}
          </div>
        </div>
      )}

      {enabledModules.includes('protection') && (
      <div className="card">
        <h3>Protection products</h3>
        <div className="sub" style={{ marginTop: 2 }}>Dry weights let the app weigh a used product into millilitres.</div>
        <div className="list" style={{ marginTop: 10 }}>
          {products.length === 0 && <div className="sub">No products yet.</div>}
          {products.map((p) => (
            <div className="logline" key={p.id}>
              <span><b>{p.name}</b> · dry {p.dryGrams}g</span>
              <span className="link" onClick={() => removeProduct(p.id)}>Remove</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="numinput" style={{ flex: 2 }} placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="numinput" style={{ flex: 1 }} type="number" inputMode="numeric" placeholder="Dry g" value={dry} onChange={(e) => setDry(e.target.value)} />
        </div>
        <button className="block center" style={{ marginTop: 8 }} onClick={add}>Add product</button>
      </div>
      )}

      <div className="card">
        <h3>This session</h3>
        <div className="sub" style={{ marginTop: 6 }}>{entries.length} events logged · in memory only, nothing saved.</div>
      </div>

      <div className="spacer-v" />
      <button className="primary block center" onClick={rerunOnboarding}>Re-run onboarding</button>
      <button className="block center" onClick={loadSample}>Load a sample measured night</button>
      <button className="ghost block center danger" onClick={reset}>Reset everything (start over)</button>
    </div>
  );
}
