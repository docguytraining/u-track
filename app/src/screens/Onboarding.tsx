import { useState } from 'react';
import { inferModules, type QuickOnboardingAnswers } from '@core';
import { useStore } from '../store';
import { MODULES, MODULE_ORDER, ONBOARD_QUESTIONS, EXPANDED_TRAITS, PRODUCT_TIERS } from '../modules';

type Step = 'welcome' | 'symptoms' | 'confirm' | 'depth';

export function Onboarding() {
  const { completeOnboarding, enabledModules, traits: savedTraits, products } = useStore();
  const rerun = enabledModules.length > 0; // re-running from Settings: skip straight to confirm
  const [step, setStep] = useState<Step>(rerun ? 'confirm' : 'welcome');
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  // Prototype default: everything on, so you deselect what you don't want.
  const [selected, setSelected] = useState<string[]>(rerun ? enabledModules : [...MODULE_ORDER]);
  const [traits, setTraits] = useState<Record<string, string>>(savedTraits);
  const [tiers, setTiers] = useState<string[]>(
    [...new Set(products.map((p) => p.tier).filter((t): t is string => !!t))],
  );

  const toConfirm = () => {
    // The core infers the module set from the plain-language answers…
    const inferred = inferModules(answers as QuickOnboardingAnswers);
    setSelected(inferred);
    setStep('confirm');
  };

  const toggleModule = (m: string) =>
    setSelected((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));
  const toggleTier = (t: string) =>
    setTiers((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const depthTraits = EXPANDED_TRAITS.filter((t) => selected.includes(t.module));
  const wantsProducts = selected.includes('protection');
  const hasDepth = depthTraits.length > 0 || wantsProducts;
  const finish = () => completeOnboarding(selected, traits, tiers);

  if (step === 'welcome') {
    return (
      <div className="screen">
        <span className="eyebrow">u-track</span>
        <h2>Let’s set up your tracking.</h2>
        <p className="lead">
          A few quick questions and the app turns on just what fits you — nothing more. You can
          change it anytime in Settings. Even a little tracking is worth showing a doctor.
        </p>
        <div className="card" style={{ marginTop: 4 }}>
          <b>Not a medical device.</b>
          <div className="sub" style={{ marginTop: 4 }}>
            u-track helps you record and share bladder-diary data with your clinician. It does not
            diagnose or treat, and it doesn’t replace medical advice.
          </div>
        </div>
        <div className="spacer-v" />
        {import.meta.env.DEV && <p className="note">Dev build · sample data + reset available in Settings.</p>}
        <p className="note">By continuing, you acknowledge the above and consent to entering health data.</p>
        <button className="primary block center big" onClick={() => setStep('confirm')}>
          I understand — get started
        </button>
      </div>
    );
  }

  if (step === 'symptoms') {
    return (
      <div className="screen">
        <span className="eyebrow">Quick setup · 1 of 2</span>
        <h2>Which of these sound like you?</h2>
        <div className="list">
          {ONBOARD_QUESTIONS.map(({ key, prompt }) => (
            <div className="card" key={key}>
              <div className="sub" style={{ color: 'var(--text)', marginBottom: 10 }}>{prompt}</div>
              <div className="chips">
                <button className={answers[key] === true ? 'selected' : ''} onClick={() => setAnswers((a) => ({ ...a, [key]: true }))}>
                  Yes
                </button>
                <button className={answers[key] === false ? 'selected' : ''} onClick={() => setAnswers((a) => ({ ...a, [key]: false }))}>
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="footer-actions">
          <button className="primary block center" onClick={toConfirm}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="screen">
        <span className="eyebrow">Setup</span>
        <h2>What should I track?</h2>
        <p className="lead">Everything’s on for the prototype — turn off anything you don’t need.</p>
        <div className="list">
          {MODULE_ORDER.map((m) => {
            const def = MODULES[m]!;
            const on = selected.includes(m);
            return (
              <button key={m} className={`block rowbtn ${on ? 'on selected' : ''}`} onClick={() => toggleModule(m)}>
                <span className="check">{on ? '✓' : ''}</span>
                <span>
                  <b>{def.label}</b>
                  <div className="sub">{def.blurb}</div>
                </span>
              </button>
            );
          })}
        </div>
        <div className="footer-actions">
          <button className="primary block center" onClick={() => (hasDepth ? setStep('depth') : finish())}>
            {hasDepth ? 'Add a little detail' : 'Start tracking'}
          </button>
          {hasDepth && (
            <button className="ghost block center" onClick={finish}>
              Skip — start tracking
            </button>
          )}
        </div>
      </div>
    );
  }

  // depth
  return (
    <div className="screen">
      <span className="eyebrow">Optional detail</span>
      <h2>A few extras to sharpen your reports.</h2>
      <p className="lead">All optional — skip any of them.</p>

      {wantsProducts && (
        <div className="card">
          <div className="sub" style={{ color: 'var(--text)', marginBottom: 4 }}>Which products do you use?</div>
          <div className="sub" style={{ marginBottom: 10 }}>Pick any — different products for different times is fine. You can rename them later.</div>
          <div className="chips">
            {PRODUCT_TIERS.map((t) => (
              <button key={t.name} className={tiers.includes(t.name) ? 'selected' : ''} onClick={() => toggleTier(t.name)}>
                {t.name} · {t.grams}g
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="list">
        {depthTraits.map((t) => (
          <div className="card" key={t.key}>
            <div className="sub" style={{ color: 'var(--text)', marginBottom: 10 }}>{t.prompt}</div>
            <div className="chips">
              {t.options.map((opt) => (
                <button key={opt} className={traits[t.key] === opt ? 'selected' : ''} onClick={() => setTraits((tr) => ({ ...tr, [t.key]: opt }))}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="footer-actions">
        <button className="primary block center" onClick={finish}>
          Start tracking
        </button>
      </div>
    </div>
  );
}
