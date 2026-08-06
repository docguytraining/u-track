# Bladder Diary — core

Portable, UI-free TypeScript core for the bladder diary app. This package is the
"brain" from the spec (`docs/spec.md`): night-boundary rules, nocturnal-polyuria math,
volume/quality handling, and the module registry. No React, no Firestore — those wrap
this later, and this ports unchanged to a native shell.

## Run it locally

Requires Node 18+ (Node 20+ recommended).

```bash
npm install
npm test          # runs the Vitest suite once
npm run test:watch
npm run typecheck
```

## Where things are

```
core/
  time/night.ts             night-boundary model (spec §4)
  reports/npi.ts            nocturnal polyuria index (spec §4.1)
  reports/report.ts         measured-day + everyday trend reports (spec §3.2)
  volume/volume.ts          volume + quality (spec §5.3)
  registry/registry.ts      module registry + profile-composed core (spec §5.4)
  profile/profile.ts        traits vs events + onboarding merge (spec §5.1)
  onboarding/onboarding.ts  symptom→module inference (spec §7.1)
  *.test.ts                 co-located tests for each module
docs/spec.md                the full design spec
```

## TDD state

The pure-logic core is **green** — 26 tests across the whole §9 plan pass
(`npm test`), `npm run typecheck` clean. Built test-red → implement-green in order:

1. **Group A — night boundary** ✅ (incl. both DST cases)
2. **Group B — NPi** ✅  3. **Group C — volume/quality** ✅  4. **Group D — registry** ✅
5. **Group E — report degradation** ✅  6. **Group F — traits vs events** ✅
7. **§9.18 — tiered onboarding** ✅ (infer → confirm → re-run preserves events)

**Design choices to review before UI** (these had no scaffold stub, so their shapes
are first-pass — all flagged in-file):
- `reports/report.ts` — the measured-day and everyday-trend report shapes.
- `profile/profile.ts` — the trait/event store and `Profile` shape.
- `onboarding/onboarding.ts` — the **exact question wording and answer→module map**
  are a draft; onboarding is "infer, then confirm" per §7.1. Edit the mapping freely.

## Continuing locally

This scaffold was generated in a session; your machine and Git repo are the source of
truth. For the ongoing local red→green loop, run it in your own environment (Claude Code
works directly in your terminal/VS Code on this repo).
