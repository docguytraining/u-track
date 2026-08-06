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
  time/night.ts        night-boundary model (spec §4)   ← implemented first
  time/night.test.ts   Group A tests (spec §9.A), incl. both DST cases
  reports/npi.ts       nocturnal polyuria index (spec §4.1, §9.B)
  volume/volume.ts     volume + quality (spec §5.3, §9.C)
  registry/registry.ts module registry + profile-composed core (spec §5.4, §9.D)
docs/spec.md           the full design spec
```

## TDD state

Every core function currently throws `not implemented`, so the suite is **red on
purpose**. The order of work follows the spec's test plan (§9):

1. **Group A — night boundary** (tests written). Implement `core/time/night.ts` to green.
2. Group B — NPi. 3. Group C — volume/quality. 4. Group D — registry composition.
5. Group E — report degradation. 6. Group F — traits vs events.

Write the test red, implement to green, then move on.

## Continuing locally

This scaffold was generated in a session; your machine and Git repo are the source of
truth. For the ongoing local red→green loop, run it in your own environment (Claude Code
works directly in your terminal/VS Code on this repo).
