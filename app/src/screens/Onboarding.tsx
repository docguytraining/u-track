import { useState } from 'react';
import { inferModules, type QuickOnboardingAnswers } from '@core';
import { useStore } from '../store';
import { MODULES, MODULE_ORDER, ONBOARD_QUESTIONS, EXPANDED_TRAITS } from '../modules';

type Step = 'welcome' | 'symptoms' | 'confirm' | 'depth';

export function Onboarding() {
  const { completeOnboarding, enabledModules, traits: savedTraits } = useStore();
  const rerun = enabledModules.length > 0; // re-running from Settings: skip straight to confirm
  const [step, setStep] = useState<Step>(rerun ? 'confirm' : 'welcome');
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string[]>(enabledModules);
  const [traits, setTraits] = useState<Record<string, string>>(savedTraits);

  const toConfirm = () => {
    // The core infers the module set from the plain-language answers…
    const inferred = inferModules(answers as QuickOnboardingAnswers);
    setSelected(inferred);
    setStep('confirm');
  };

  const toggleModule = (m: string) =>
    setSelected((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]));

  const depthTraits = EXPANDED_TRAITS.filter((t) => selected.includes(t.module));

  if (step === 'welcome') {
    return (
      <div className="screen">
        <span className="eyebrow">Bladder diary</span>
        <h2>Let’s set up your tracking.</h2>
        <p className="lead">
          A few quick questions and the app turns on just what fits you — nothing more. You can
          change it anytime in Settings. Even a little tracking is worth showing a doctor.
        </p>
        <div className="spacer-v" />
        <p className="note">Prototype · nothing is saved · everything resets on refresh.</p>
        <button className="primary block center big" onClick={() => setStep('symptoms')}>
          Get started
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
        <span className="eyebrow">Quick setup · 2 of 2</span>
        <h2>Here’s what I’ll track for you.</h2>
        <p className="lead">Based on your answers. Tap to add or remove anything.</p>
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
          <button
            className="primary block center"
            onClick={() => (depthTraits.length ? setStep('depth') : completeOnboarding(selected, traits))}
          >
            {depthTraits.length ? 'Add a little detail' : 'Start tracking'}
          </button>
          {depthTraits.length > 0 && (
            <button className="ghost block center" onClick={() => completeOnboarding(selected, traits)}>
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
        <button className="primary block center" onClick={() => completeOnboarding(selected, traits)}>
          Start tracking
        </button>
      </div>
    </div>
  );
}
