# u-flow

**A bladder diary that treats you like an adult.**

👉 **[Try it — u-flow.fyi](https://u-flow.fyi)** · free · nothing to install · works in any browser (and installs as an app if you want)

u-flow turns the vague conversation you dread at the doctor's office — *"how often? …sometimes? a lot? I don't know"* — into real, timestamped data you can hand your provider. It's a private, matter-of-fact diary for anyone living with urinary frequency, urgency, leaks, nighttime symptoms, or incontinence of any cause.

It is **not** a diagnostic tool. It's a **trend tracker**: it records what happened and shows you your own patterns, so you walk into an appointment with evidence instead of a guess.

---

## Why it's different

Most tracking apps are either clinical spreadsheets or cheerful habit-streak toys. Incontinence deserves neither. u-flow is built on a few firm principles:

- **Describe, don't judge.** Every screen states a fact about what happened — no verdicts. A wet night and a dry night are recorded exactly the same way, like noting the weather. No shame, and no cheerleading either (a 🎉 for a dry night would quietly make a wet one a failure).
- **Plain, clinical language — never a confession.** It uses the words your doctor uses, and it never asks you to justify a void or admit you did something "on purpose."
- **It only asks what applies to you.** A quick, plain-language setup infers what's relevant, so you're never staring at questions about symptoms you don't have. Day-to-day logging is a couple of taps.
- **Every question earns its place.** Each one either gives your doctor something they'd actually act on, or helps you see a pattern that gives you more control. If it does neither, it's not there.
- **Your data is yours.** Use it as a guest and it never leaves your device; sign in and it syncs privately to your own cloud store. It's never sold or shared.

## What you can track

- **Voids** — where it went (toilet, into protection, or both), how much (measured, or a rough size), urgency, stream/emptying.
- **Leaks** — urine that escaped, with what set it off and how much.
- **Fluids** — intake, with caffeine/alcohol timing that drives nighttime symptoms.
- **Protection** — changes, weighed for a real absorbed volume, and how your products hold up.
- **Nights** — a 30-second morning check-in reconstructs the night you didn't log live: awakenings, wet/dry, and the all-important first-morning void.

## What you get back

A report you can read — and **print for an appointment**:

- Frequency-volume chart (the standard bladder-diary view)
- Functional bladder capacity, daytime vs. nighttime frequency
- Nocturia and the **nocturnal polyuria index (NPi)** — withheld unless the numbers are genuinely measured, never guessed
- Your own trends over weeks, so "is this getting better or worse?" has an answer

## ⚠️ Medical disclaimer

u-flow is a **personal tracking aid, not a medical device.** It does **not** diagnose, treat, cure, or prevent any condition, and it does **not** provide medical advice.

- Nothing here is a substitute for professional medical care. Always seek the advice of a qualified healthcare provider with any questions about your health, and never disregard or delay that advice because of something you saw in this app.
- Some symptoms need prompt attention, not a trend line — **blood in your urine, pain or burning when you urinate, fever, or a sudden change** all warrant contacting a healthcare professional.
- The software is provided "as is," without warranty of any kind (see [LICENSE](LICENSE)).

## Privacy

- **Guest mode:** everything stays in your browser on your device.
- **Signed in (optional):** your diary syncs to your own account in Google Firebase, encrypted in transit and at rest. Only you read it. It is never sold or shared, and you can delete it at any time.

## Feedback & contributing

This is open source (MIT), and it's shared in the hope it helps someone else too. Bug reports, ideas, and corrections — especially from clinicians and from people who live with this — are genuinely welcome. Open an [issue](https://github.com/docguytraining/u-track/issues) or a pull request.

---

## For developers

A small monorepo: a portable, UI-free TypeScript **core** (the clinical logic — night-boundary rules, NPi math, the module registry) and a React **app** that wraps it. The core has no React or Firebase in it, so the hard-to-get-right logic is tested in isolation and could port to a native shell later.

```
core/            pure TypeScript logic (no UI) — night math, NPi, registry, volume
  *.test.ts      co-located Vitest suites
app/             the React + Vite PWA that wraps the core
docs/spec.md     the full design spec
docs/backlog.md  design decisions and what's planned next
```

Requires Node 18+ (20+ recommended).

```bash
npm install            # root (core) deps
npm test               # core test suite (Vitest)
npm run typecheck

npm --prefix app install   # app deps
npm --prefix app test      # app test suite
npm --prefix app run dev   # run the app locally
npm --prefix app run build # production build → app/dist
```

**Deployment** is automatic: every merge to `main` runs both test suites, builds, and deploys to Firebase Hosting via GitHub Actions (`.github/workflows/deploy.yml`). The Firebase web config comes from repo Variables; the deploy credential from the `FIREBASE_SERVICE_ACCOUNT` secret.

## License

[MIT](LICENSE) © the u-flow contributors.
