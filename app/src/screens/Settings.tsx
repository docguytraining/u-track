import { useState } from 'react';
import { useStore } from '../store';
import { Topbar } from '../ui';
import { MODULES, PRODUCT_TIERS, DEFAULT_DRINK_NAMES } from '../modules';
import { humanize } from '../insights';
import { cloudEnabled, usingEmulator } from '../firebase';

export function Settings() {
  const { enabledModules, traits, products, drinkTypes, units, entries, user, navigate, reset, loadSample, rerunOnboarding, addProduct, updateProduct, removeProduct, removeDrinkType, addDrinkType, setUnits, signOut } = useStore();
  const removedDrinks = DEFAULT_DRINK_NAMES.filter((d) => !drinkTypes.includes(d));
  const [tier, setTier] = useState('');
  const [name, setName] = useState('');
  const [dry, setDry] = useState('');

  // Pick a type first → weight (and a starting name) auto-fill → you rename it.
  const pickTier = (t: { name: string; grams: number }) => {
    setTier(t.name);
    setDry(String(t.grams));
    if (!name.trim()) setName(t.name);
  };

  const add = () => {
    const g = Number(dry);
    if (name.trim() && dry !== '' && !Number.isNaN(g)) {
      addProduct(name.trim(), g, tier || undefined);
      setTier('');
      setName('');
      setDry('');
    }
  };

  return (
    <div className="screen">
      <Topbar title="Settings" onBack={() => navigate('home')} />

      <div className="card">
        <h3>Account</h3>
        {!cloudEnabled ? (
          <div className="sub" style={{ marginTop: 6 }}>Cloud sync isn’t configured (no Firebase env). Running local-only.</div>
        ) : user ? (
          <>
            <div className="sub" style={{ marginTop: 6 }}>
              Signed in as <b style={{ color: 'var(--text)' }}>{user.email ?? user.name ?? 'you'}</b> · syncing{usingEmulator ? ' (emulator)' : ''}.
            </div>
            <button className="ghost block center" style={{ marginTop: 10 }} onClick={signOut}>Sign out</button>
          </>
        ) : (
          <>
            <div className="sub" style={{ marginTop: 6 }}>
              Using locally — data resets on refresh. Sign in to sync across your phone and iPad.
              {usingEmulator ? ' (emulator: any fake account works)' : ''}
            </div>
            <button className="primary block center" style={{ marginTop: 10 }} onClick={() => navigate('signin')}>Sign in</button>
          </>
        )}
      </div>

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
              <div className="logline" key={k}><span>{humanize(k)}</span><b>{String(v)}</b></div>
            ))}
          </div>
        </div>
      )}

      {enabledModules.includes('protection') && (
      <div className="card">
        <h3>Protection products</h3>
        <div className="sub" style={{ marginTop: 2 }}>Rename or adjust weight anytime — dry weights turn a wet product into millilitres.</div>

        <div className="list" style={{ marginTop: 12 }}>
          {products.length === 0 && <div className="sub">No products yet.</div>}
          {products.map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="numinput" style={{ flex: 2 }} value={p.name} onChange={(e) => updateProduct(p.id, { name: e.target.value })} />
              <input className="numinput" style={{ width: 76 }} type="number" inputMode="numeric" value={p.dryGrams} onChange={(e) => updateProduct(p.id, { dryGrams: Number(e.target.value) })} />
              <button className="ghost danger" style={{ minHeight: 48, padding: '0 12px' }} onClick={() => removeProduct(p.id)}>✕</button>
            </div>
          ))}
        </div>

        <div className="hr" />
        <div className="sub" style={{ marginBottom: 8 }}>Add a product — pick a type, then name it:</div>
        <div className="chips">
          {PRODUCT_TIERS.map((t) => (
            <button key={t.name} className={tier === t.name ? 'selected' : ''} onClick={() => pickTier(t)}>
              {t.name} · {t.grams}g
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="numinput" style={{ flex: 2 }} placeholder="Name it" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="numinput" style={{ width: 76 }} type="number" inputMode="numeric" placeholder="Dry g" value={dry} onChange={(e) => setDry(e.target.value)} />
        </div>
        <button className="block center" style={{ marginTop: 8 }} onClick={add} disabled={!name.trim() || dry === ''}>Add product</button>
      </div>
      )}

      <div className="card">
        <h3>Units</h3>
        <div className="sub" style={{ marginTop: 2 }}>How volumes show and enter. Stored the same either way.</div>
        <div className="chips" style={{ marginTop: 10 }}>
          <button className={units === 'oz' ? 'selected' : ''} onClick={() => setUnits('oz')}>Ounces (oz)</button>
          <button className={units === 'ml' ? 'selected' : ''} onClick={() => setUnits('ml')}>Millilitres (ml)</button>
        </div>
      </div>

      <div className="card">
        <h3>Drinks</h3>
        <div className="sub" style={{ marginTop: 2 }}>Tap to remove types you never drink — they won’t be offered when logging.</div>
        <div className="chips" style={{ marginTop: 10 }}>
          {drinkTypes.map((d) => (
            <button key={d} className="selected" onClick={() => removeDrinkType(d)}>{d} ✕</button>
          ))}
        </div>
        {removedDrinks.length > 0 && (
          <>
            <div className="sub" style={{ marginTop: 12, marginBottom: 6 }}>Removed — tap to add back:</div>
            <div className="chips">
              {removedDrinks.map((d) => (
                <button key={d} className="ghost" onClick={() => addDrinkType(d)}>+ {d}</button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>This session</h3>
        <div className="sub" style={{ marginTop: 6 }}>{entries.length} events logged · in memory only, nothing saved.</div>
      </div>

      <div className="spacer-v" />
      <button className="primary block center" onClick={rerunOnboarding}>Re-run onboarding</button>
      <button className="block center" onClick={loadSample}>Load a few weeks of sample data</button>
      <button className="ghost block center danger" onClick={reset}>Reset everything (start over)</button>
    </div>
  );
}
