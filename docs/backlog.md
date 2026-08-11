# Backlog & design decisions

Working record of decisions from the wetting/void design pass. Living doc — not a spec
yet. The design principles below are standing rules.

**The actionable backlog now lives in [GitHub issues](https://github.com/docguytraining/u-track/issues).**
This file is the *why* — the design rationale and the record of what we decided and why.
Open work is tracked as tickets; this doc links to them rather than duplicating them.

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

## Shipped since (the "agreed — to build" list)

All five agreed items have shipped or are in review — kept here as the rationale record:

1. **Void as the umbrella model.** Everything is a VOID (bladder emptying) with two
   attributes instead of separate event types — **where** (toilet / product / both) and
   **leaked?** (did any escape containment). A product that escaped is the leak that
   matters (product-adequacy signal). Collapsed the old void/wetting/leak types into one
   void + attributes, with a migration for existing entries.
2. **Urgency tied to the leak, per episode** (provider gap 5). A single void carries both
   *was it urgent?* and *did it leak?* — the pairing that separates stress vs urge vs
   mixed.
3. **Product form factor** (from the "diaper" discussion). Specific, inclusive product
   types as a product-library property (set once), powering adequacy and cost signals —
   plus day/night usage tags that scope which products are offered when logging.
4. **Weekly opt-in bother / QoL check-in** (provider gap 1). A trend over weeks: two
   neutral 0–10 scales (interference, bother), framed as *interference with daily life*,
   opt-in and dismissible. Uses our own plain wording, **not** a validated instrument
   verbatim — see issue on licensing before that line is ever crossed.
5. **Medications & timing** (provider gap 2). Meds captured as context (with timing), so
   an evening diuretic isn't misread as nocturia on the chart.

## Deferred — tracked as issues

- **Red flags: pain and blood** (provider gap 3) →
  [#21](https://github.com/docguytraining/u-track/issues/21). Dysuria and hematuria as
  plain factual notes, surfaced calmly as "worth mentioning to your doctor" — needs
  wording design before build.
- **Bowel / constipation** (provider gap 4) →
  [#22](https://github.com/docguytraining/u-track/issues/22). A lightweight signal;
  constipation drives urgency/frequency.
- **Validated-instrument licensing** (caveat from item 4) →
  [#23](https://github.com/docguytraining/u-track/issues/23). Verify ICIQ/IPSS wording &
  licensing before ever presenting a scale *as* a named instrument.
