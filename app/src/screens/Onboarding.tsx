import { useState } from 'react';
import { inferModules, type QuickOnboardingAnswers } from '@core';
import { useStore } from '../store';
import { MODULES, MODULE_ORDER, ONBOARD_QUESTIONS, EXPANDED_TRAITS, PRODUCT_TIERS } from '../modules';

type Step = 'welcome' | 'symptoms' | 'confirm' | 'depth';

export function Onboarding() {
  const { completeOnboarding, enabledModules, traits: savedTraits, products, navigate } = useStore();
  const rerun = enabledModules.length > 0; // re-running from Settings: skip straight to confirm
  const [step, setStep] = useState<Step>(rerun ? 'confirm' : 'welcome');
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  // Prod: normal flow (symptom questions → inferred, starts empty). Dev: everything on
  // so you can deselect quickly.
  const [selected, setSelected] = useState<string[]>(
    rerun ? enabledModules : import.meta.env.DEV ? [...MODULE_ORDER] : [],
  );
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
        <h1>A bladder diary that turns into data for your doctor.</h1>
        <p className="lead">
          Tap to log when you go, leak, or drink. u-track turns it into a frequency-volume chart and a
          plain-English summary you can hand to your clinician — instead of trying to remember it all in
          the exam room.
        </p>
        <div className="card" style={{ marginTop: 4 }}>
          <b>Private by design.</b>
          <div className="sub" style={{ marginTop: 4 }}>
            Your diary stays on this device. Nothing is uploaded unless you choose to sign in to sync
            across your phone and tablet.
          </div>
        </div>
        <div className="card">
          <b>Not a medical device.</b>
          <div className="sub" style={{ marginTop: 4 }}>
            u-track helps you record and share bladder-diary data with your clinician. It does not
            diagnose or treat, and it doesn’t replace medical advice.
          </div>
        </div>
        <div className="spacer-v" />
        {import.meta.env.DEV && <p className="note">Dev build · sample data + reset available in Settings.</p>}
        <p className="note">
          A few quick questions set up just what fits you — change it anytime in Settings. By continuing
          you consent to entering health data.
        </p>
        <div className="footer-actions">
          <button className="primary block center big" onClick={() => setStep(import.meta.env.DEV ? 'confirm' : 'symptoms')}>
            Start tracking — no account needed
          </button>
          <button className="ghost block center" onClick={() => navigate('signin')}>
            Already have an account? Log in
          </button>
        </div>
      </div>
    );
  }

  if (step === 'symptoms') {
    return (
      <div className="screen">
        <span className="eyebrow">Quick setup · 1 of 2</span>
        <h1>Which of these sound like you?</h1>
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
        <span className="eyebrow">{import.meta.env.DEV ? 'Setup' : 'Quick setup · 2 of 2'}</span>
        <h1>What should I track?</h1>
        <p className="lead">
          {import.meta.env.DEV
            ? 'Everything’s on — turn off anything you don’t need.'
            : 'Based on your answers. Tap to add or remove anything.'}
        </p>
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
      <h1>A few extras to sharpen your reports.</h1>
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
