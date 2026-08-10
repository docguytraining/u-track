# Backlog & design decisions

Working record of decisions from the wetting/void design pass. Living doc — not a spec
yet. Items are grouped by status. The design principles at the bottom are standing rules.

## Standing design principles

- **Describe, don't judge.** Every line — questions, options, labels, confirmations,
  helper notes — states a fact about what happened. No verdict.
- **No emotion in either direction.** No shame *and* no cheerleading. A wet night and a
  dry night are recorded the same way, like noting the temperature. No streaks, no
  "great job," no sympathy. Praising dry implicitly shames wet.
- **Name it plainly; don't dance.** Euphemism and avoidance *are* a form of shame — they
  signal the thing is too bad to say. Prefer direct clinical terms (they're neutral
  precisely because they name the thing without charge). "Leak" stays.
- **Never ask the user to justify or confess.** Capture *circumstance* ("couldn't get to
  one"), never *motive* ("on purpose"). "Intentional" is undefinable and loaded — it's out.
- **Main vs additional.** Fast-path questions are the ones tied to a diagnostic
  instrument; everything else is optional, behind "Track anything else?", never required.
- **Don't show what doesn't apply.** Gate questions on the profile/answers (e.g. awareness
  only for reduced-sensation profiles; the wet-night question only when wet).
- **Fewer questions.** The more we ask, the less gets answered.
- **Not diagnostic.** A trend tracker that hands the person meaningful data to take to
  the doctor — it surfaces patterns, it never diagnoses.

## Shipped this pass (PR #3)

- One **Void** entry that branches on where it went (Toilet / Product / Both); a wetting
  is reached only through Void.
- Wetting recorded distinctly so volume/capacity/nocturia math (continent, measured voids
  only) stays clean while frequency counts both.
- Core/gateway rule applied to the wetting questions (leak severity + trigger are the
  instrument-tied main questions; awareness etc. are optional).
- Awareness question scoped to reduced-sensation profiles and reworded (no arousal/blame).
- Morning check-in: hide inapplicable questions; first-morning volume is destination-aware
  (a wet morning logs the overnight output as a change, not a phantom toilet void).
- Unified single-stroke icon set; fixed the Report → Activity crash.

## Agreed — to build

1. **Void as the umbrella model.** Everything is a VOID (bladder emptying). Attach two
   facts instead of separate event types:
   - **Where:** toilet / product / combination.
   - **Leaked?** did any escape containment. Infer where possible: no product + not the
     toilet ⇒ leak; product that held ⇒ not a leak; product that escaped ⇒ the leak that
     matters (product-adequacy signal). This collapses today's separate void/wetting/leak
     types into one void + attributes.
2. **Urgency tied to the leak, per episode** (provider gap 5). A single void must be able
   to carry both *was it urgent?* and *did it leak?* — that pairing is what separates
   stress vs urge vs mixed, which decides treatment.
3. **Product form factor** (from the "diaper" discussion). Replace the vague "Diaper"
   option with specific, inclusive types — Pad/guard · Pull-up (disposable) · Washable
   underwear · Tabbed brief. Track form factor as a **product-library property** (set
   once), so it can power two signals: adequacy (frequent escapes ⇒ size up) and cost
   (e.g. four disposable briefs/day vs one high-capacity brief).
4. **Weekly opt-in bother / QoL check-in** (provider gap 1). Daily logging already is the
   *symptom* side of the standard questionnaires; this adds the *bother* item at the
   bottom — as a trend over weeks rather than a one-off office snapshot. Mirror the right
   item per profile (ICIQ-UI-style 0–10 "interference with everyday life" for
   incontinence; IPSS-style QoL for emptying/BPH; nocturia QoL). ~3 questions, opt-in,
   dismissible. Framed as *interference with daily life*, not "how bad do you feel" — so it
   stays matter-of-fact. **Verify exact wording/scoring and licensing before embedding any
   validated instrument verbatim** (ICIQ requires registration; IPSS is freely usable).
5. **Medications & timing** (provider gap 2). Capture meds — especially diuretics and
   their timing, and what's already been tried — as context, so the frequency/nocturia
   chart isn't misread (e.g. an evening water pill masquerading as nocturia).

## Backlog — deferred

- **Red flags: pain and blood** (provider gap 3). Let the user note dysuria (burning) and
  hematuria (blood) as plain factual observations — never a diagnosis, but the things that
  shouldn't wait for a trend. Surface gently as "worth mentioning to your doctor."
- **Bowel / constipation** (provider gap 4). A lightweight signal — constipation and
  straining press on the bladder and can drive urgency/frequency.
