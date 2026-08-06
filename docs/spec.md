# Bladder Diary — Design Specification

**Version:** 2.0 (supersedes the ChatGPT-era draft)
**Owner:** single user, tracking their own bladder habits over time
**Status:** agreed architecture, pre-implementation

---

## 1. What this is (30,000 ft)

A personal bladder-tracking app for one person, used across an iPhone and an iPad, whose job is to produce something a urologist will actually find useful.

It exists to answer three clinical questions that look identical from the outside — the person is up at night — but have different causes and different treatments:

1. **Are they making too much urine at night?** (nocturnal polyuria)
2. **Is the bladder not emptying well?** (outlet/emptying problem, e.g. BPH)
3. **Are they not waking to the signal?** (sensation/awareness problem)

Volume-over-time is what separates these. So the product has to capture volume when it can — without ever demanding it, because nobody pulls out a measuring jug at their office urinal.

**The organizing principle for every feature below:** partial data is the normal case, not an error. Void counts always work with zero effort. Richer numbers (the nocturnal polyuria index especially) unlock when the person opts into a careful day. The app must degrade honestly — show what the data can support, flag what it can't, and never compute a misleading number from an incomplete window.

---

## 2. Architecture

### 2.1 Platform

Installable **web app (PWA)** first, added to the home screen on both devices. Own icon, full-screen, works offline, syncs through the cloud.

Rationale: no App Store gate or review cycle, one codebase for phone and iPad, and — because the whole thing is testable in a normal dev loop — we can do real test-driven development. The one thing we give up is reliable push reminders on iOS, so the design must not depend on nags (see the morning catch-up screen, §7.5).

**Portability is a hard requirement, not an afterthought.** The hard-to-get-right logic — module registry, night-boundary rules, nocturnal-polyuria math, volume-quality handling — is pure TypeScript with no UI in it. That is the part we test heavily and the part that ports unchanged to a React Native or native Swift shell later. Screens are replaceable; the brain is not. If we ever want the Lock Screen widget and Apple Health, we rebuild the screens and keep the core.

### 2.2 Data / sync

**Firestore + Google sign-in.** Offline persistence is built in, so a 3 a.m. tap writes locally and syncs whenever there's signal. At one user's volume it stays on the free tier indefinitely.

**Privacy decision (made deliberately):** Firebase-default, Google-managed keys — encrypted at rest and in transit, Google holds the keys. We considered client-side passphrase encryption (Google sees only ciphertext) and deferred it: it's viable here because a single user queries everything locally anyway, but losing the passphrase means losing the data with no reset. Revisit if the threat model changes. See §8.

### 2.3 Core / shell separation

```
┌─────────────────────────────────────────────┐
│  Screens (PWA now → native later)            │  replaceable
├─────────────────────────────────────────────┤
│  CORE (pure TypeScript, heavily tested)      │  portable
│   • module registry                          │
│   • time & night-boundary model              │
│   • volume + quality model                   │
│   • report/aggregation engine (NPi, counts)  │
├─────────────────────────────────────────────┤
│  Persistence adapter → Firestore             │  swappable
└─────────────────────────────────────────────┘
```

The core never imports UI or Firestore directly; it talks to interfaces. That's what makes it testable in isolation and portable.

---

## 3. Two modes

The app has two modes that feel completely different, because they serve different moments.

### 3.1 Everyday mode (where the person lives)

Tap when you void. Tap if there's urgency or a leak. Answer one question in the morning about the night. No jug, no numbers, four seconds at a desk. This produces the **long-run trend** — void counts, night awakenings, wet nights, protection use, symptom drift over months. This is most of what a urologist reviews.

### 3.2 Measured day (opt-in, guided)

A 24-hour window the person starts on a chosen day (a weekend or day off — the standard 3-day frequency-volume chart is *meant* to be done on days you pick, not arbitrary ones). The app switches into a guided state: it knows it's collecting a complete window, prompts for volume on each void, and tells you when the window closes and whether it got everything it needed.

Three of these, ideally not consecutive, make the **nocturnal polyuria index** computable — the number that actually separates "too much urine at night" from "bladder isn't emptying."

**Failure-state rule:** a measured day must never feel like failure. Eleven of thirteen voids measured → it says so and computes what it honestly can, flagged incomplete. Skipped for two months → everyday tracking is still producing something worth showing a doctor. This rule is load-bearing; enforce it in the report layer, not just the copy.

---

## 4. Time & the night boundary (the trickiest logic)

A "night" is not a calendar day, and this is where naive implementations quietly corrupt every night-spanning report. Definitions we're committing to, aligned with how the clinical measures are actually defined:

- **Sleep period start** = when the person goes to bed with the intent to sleep. The void taken *right before bed* is **excluded** from nocturnal volume (the bladder is emptied at the start of the sleep period).
- **Sleep period end** = rising for the day.
- **Nocturnal urine volume (NUV)** = every void from just after bedtime through **the first void within ~30 minutes of rising** — and that first morning void **is included**, because it represents urine produced during sleep. This is why the first-morning-void habit earns its own prompt (§7.6): it's the single most informative volume in the chart.
- **Nocturia count** (frequency) = voids during the sleep period that are followed by a return to sleep. Subtle but real: the first morning void **contributes its volume to NUV but does *not* count as a nocturia episode** (you're rising, not going back to sleep). These two facts about the same void must be handled separately — good test case.
- **Night key.** Every night-scoped record is keyed to a single `nightId` (e.g. the date the sleep period began), user-configurable default window ~21:00–09:00, so night-spanning records aggregate correctly.

**Store instants, not wall-clock.** Persist UTC/epoch timestamps; compute durations on instants; render in local time. On DST nights, elapsed time ≠ clock difference, so any logic keyed to displayed clock times breaks twice a year. This gets an explicit test (§9).

### 4.1 Nocturnal polyuria index

```
NPi = NUV / (total 24-hour voided volume)
```

Threshold commonly cited as **> 0.33** (nocturnal volume > 33% of 24-hour volume). Note the threshold is **age-dependent** — nearer 20% in younger people, 33% in older — so the app **stores the ratio and flags it against the threshold; it does not render a diagnosis.** NPi is only computed from a window where the contributing voids are actually measured/weighed; otherwise it's withheld or clearly marked estimate-contaminated.

---

## 5. Data model

### 5.1 Traits vs events (fixing the old bug)

The ChatGPT draft's `bladderAwarenessProfile` mixed two kinds of data that must not be averaged together:

- **Traits** — answered rarely, at onboarding or in settings. "How much warning do you usually get?" "Do you use catheterization?" Stored in a `profile` document.
- **Events** — timestamped facts about a specific moment. This void, this leak, this night. Stored as append-only `events`.

Keeping them apart is what stops a report from averaging a setting against an observation.

### 5.2 Event shape

```json
{
  "id": "…",
  "type": "void | leak | night | morning | catheter | protection | ipss",
  "at": 1730000000000,          // epoch ms, the instant
  "nightId": "2026-08-05",      // present on night-scoped events
  "modules": ["bph", "nocturia"],
  "detail": { … },              // type-specific, all optional
  "volume": {                   // present where a volume applies
    "value": 350,               // mL, or null
    "quality": "measured | weighed | estimated | none",
    "range": "300-500"          // when quality = estimated
  }
}
```

### 5.3 Volume quality (the "sometimes, when I can" reality)

Every volume field carries a **quality flag**, and every volume field has a **qualitative fallback** so the person is never blocked:

- `measured` — jug/hat, a real mL number.
- `weighed` — diaper/guard dry-vs-wet grams, 1 g ≈ 1 mL.
- `estimated` — light / moderate / heavy / saturated, stored as a range.
- `none` — logged the event, skipped volume entirely. Still valid.

Reports read the flag and degrade accordingly. This flag is what lets the app be honest instead of confidently wrong.

### 5.4 Module registry contract

Adding a future medical domain must not touch the core. Each module is a registry entry:

```ts
interface TrackingModule {
  id: string;                    // "bph", "nocturia", "awareness", …
  enabled: boolean;
  eventTypes: string[];          // what it contributes
  questions: QuestionDef[];      // additions to void/leak/night/morning surfaces
  reports: ReportDef[];          // what it feeds
  widgets: WidgetDef[];          // dashboard tiles when enabled
}

interface QuestionDef {
  id: string;                    // stable; used for dedup across modules
  surface: "void" | "leak" | "night" | "morning";
  coreEligible: boolean;         // may claim a fast-path slot on this surface
  priority: number;              // arbitration weight when core demand > budget
  // …prompt, options, storage mapping
}
```

The core iterates the registry to assemble surfaces and reports. New module = new entry, no core change. This preserves the one genuinely good bone of the original draft.

**Composition rules (this is where the app's adaptability actually lives):**

- The **core** of each surface is *composed from the enabled modules*, not fixed. It is not a global choice — a BPH profile, an OAB profile, and an enuresis-only profile each get a different (or empty) core for the same surface.
- **Core budget per surface = 2** (the "one, maybe two" of §7.0). Fill by `priority` among `coreEligible` questions; everything else falls to the "Track anything else?" gateway.
- **Empty core is valid.** If no enabled module claims a core slot on a surface, that surface is a pure tap. An enuresis-only profile's *daytime void* has no core question — all its signal is in the morning flow.
- **Dedup by `question.id`.** A symptom owned by two modules (e.g. nocturia appears in both the nocturia module and IPSS) is added once, not twice.
- **Gateway = every enabled-module question for that surface** that didn't make core. Modules the user doesn't have never appear.


---

## 6. Modules & the instruments they map to

We lean on validated urology instruments rather than inventing questions, so the output is legible to a clinician at a glance.

### 6.1 BPH / emptying → IPSS + per-void capture

Two complementary things, not one:

- **Per-void detail (event-level, optional).** Logged against a specific void, right after it happens. Over weeks this gives real frequencies ("strained on 40% of voids") instead of a fuzzy monthly guess. The cluster:
  - **hesitancy** — latency before the stream starts ("how long you stood there").
  - **straining** — split into *straining to initiate* vs *straining to maintain*; they point at slightly different things.
  - **stream force** — perceived ordinal (strong / normal / weak / dribble). Subjective without a flowmeter — but IPSS is subjective here too; the *trend* is what's telling.
  - **intermittency** — stops and starts.
  - **terminal / post-void dribble.**
  - **incomplete emptying** — still feels full afterward.
- **IPSS (recall snapshot, occasional).** The validated 7-question score a urologist reads instantly. Seven symptoms — incomplete emptying, frequency, intermittency, urgency, weak stream, straining, nocturia — each 0–5, plus one quality-of-life question; total 0–35; bands 0–7 mild, 8–19 moderate, 20–35 severe (AUA, 1992). Offered periodically, not per-void.

**Critical UX constraint:** none of this cluster sits on the fast path. Per the universal pattern (§7.0), the void gets a tap plus at most one core question; this entire cluster lives behind the "Track anything else?" gateway. It auto-surfaces during a measured day and otherwise stays tucked away.

### 6.2 Nocturia → NPi + counts

Night events feed the nocturia count and, when volumes exist, NUV and the NPi ratio (§4.1). Morning question drives the count; measured nights drive the ratio.

### 6.3 Leakage → ICIQ-UI SF / OABSS

Event-level leaks with trigger (urge / stress / functional / unknown) and severity. For a validated snapshot, **ICIQ-UI SF** is the standard short incontinence questionnaire; **OABSS** for overactive bladder. *Exact scoring to be confirmed before embedding — not hard-coding numbers I haven't verified.*

### 6.4 Nighttime wetting → event + awareness

Wet/dry, protection used, estimated (or weighed) volume, and **awareness** (woke before / slept through / discovered after). Awareness is the bridge to §6.6.

### 6.5 Protection → weight-based volume

Product library with dry weights; wet weight minus dry weight ≈ mL. This is the realistic overnight volume path when a jug isn't in play.

### 6.6 Bladder awareness (the reframed neurogenic module)

Kept from the draft because the awareness/warning/control split is genuinely good modeling — but stored as **traits**, not events (§5.1). Filling awareness (normal / delayed / minimal / absent), usable warning time, leak awareness, emptying confidence, and optional management routine (scheduled voiding, catheterization). These modify other surfaces' questions (e.g. reduced awareness reshapes the morning wetting question) without duplicating them.

### 6.7 The 3-day frequency-volume chart

Not a module — it's the **export format** three measured days produce, and the artifact the urologist actually expects. The reporting engine assembles it.

---

## 7. UX, screen by screen

Dark by default. One-handed. Optimized for a half-asleep person in the dark who did not log at the time and needs to reconstruct.

### 7.0 Interaction pattern (universal)

Every event surface follows the same rhythm, so the person never has to relearn it:

1. **Log the event** — the tap itself. This alone is always valid data.
2. **Core: one, maybe two questions — composed from the enabled modules, not fixed.** Only the highest-priority `coreEligible` questions the person's profile actually cares about (§5.4), as quick taps. Skippable. For some profiles a given surface has *no* core question and stays a pure tap.
3. **Optional gateway: "Track anything else?"** One prompt that opens the rest of the enabled modules' questions for that surface. Answer as many or as few as apply, or ignore it entirely.

**The one exception is the morning flow (§7.5), which is always the full flow** — all questions from the person's enabled modules, ungated (still only their modules — an enuresis profile's morning isn't cluttered with BPH questions). It's once a day, it's the reconstruction moment, and it's the richest clinical window, so length is earned there and nowhere else.

During a **measured day**, the core step also prompts volume and the gateway's extended set is surfaced by default — the person is already in careful mode, so the app leans in.

### 7.1 Onboarding — tiered, infer, don't self-classify

Onboarding is the same rhythm as everything else (§7.0), one level up: a short core, with optional depth.

**Quick onboard (always).** A few plain-language symptom questions — "Do you wake at night to urinate?" "Do you ever leak?" — and the app **infers** which modules to enable. No checkbox list of conditions: self-classifying at the moment you know least is bad UX. This alone gets the person tracking immediately.

**Expanded onboard (optional).** If they want, they continue into the trait-level detail (§5.1) that sharpens the modules just enabled — bladder-awareness and warning-time answers, protection products and dry weights, measurement preference and the first-void habit. Skipping it costs nothing; those traits just stay at sensible defaults until set.

**Re-runnable.** Onboarding lives as a Settings module, so the person can re-run either tier whenever their situation changes — a new symptom, a new protection product, starting a catheter routine. Re-running edits the profile; it never wipes logged events.

### 7.2 Home / dashboard — adaptive

Tiles rendered from enabled modules' `widgets`. A BPH+nocturia+protection user sees a night summary, first-void prompt, and an emptying check; an urgency+leakage user sees bathroom/leak/patterns. The `+ Add event` action is always one tap away.

### 7.3 The void — tap, then profile-composed core

The whole product succeeds or fails here. Tap logs the void, timestamped — that alone is complete. The **core question(s)** are composed from the enabled modules (§5.4), so they differ by profile:

- OAB / urgency profile → core is *urgency* (none / mild / strong).
- BPH profile → core is a stream/emptying question, or nothing with the emptying cluster in the gateway.
- Enuresis-only profile → **no** core question; the daytime void is a pure tap.

Everything a profile doesn't promote to core lives behind "Track anything else?" During a measured day, volume joins the core step regardless of profile.

### 7.4 Leak — tap, then core

Tap logs the leak. **Core (up to two):** severity and trigger (urge / stress / functional / unknown). Awareness, protection, and volume sit behind the "anything else?" gateway.

### 7.5 Morning catch-up (replaces reminders)

Because we can't depend on iOS push, the morning screen lets the person reconstruct the night they didn't log in real time: "How was your night?" (slept through / woke to urinate / woke multiple times / woke wet / unsure), plus the first-void prompt. This is the safety net that makes missed live logging a non-event.

### 7.6 First morning void — its own tiny habit

One number, once a day, no jug beyond a cheap container by the toilet — and if they don't want to or can't, the qualitative size fallback (§5.3) applies here too. It's the single most informative volume, so it gets a dedicated, low-friction prompt rather than being buried in the general void flow.

### 7.7 Measured day — guided

Start toggle (pick your day) → app enters careful mode → volume prompted on each void, detail cluster surfaced → window-close summary that states completeness honestly and computes what it can.

### 7.8 Settings

Account, **re-run onboarding (quick or expanded, §7.1)**, module toggles (the override list), night-window bounds, protection products, measurement preferences, privacy, and the (currently off) reminder options.

---

## 8. Privacy

Firebase-default encryption, Google-managed keys. Google can see timestamps and record contents; it cannot be assumed blind. The client-side-passphrase option (Google sees only ciphertext, no recovery if the passphrase is lost) is documented and deferred. Because this is incontinence data tied to a Google identity, revisit deliberately rather than by drift. No sensitive detail ever goes into a URL or query string.

---

## 9. Test plan (write these first, watch them fail)

Ordered so the pure-logic core is proven before any screen exists. Each is a failing test before its implementation.

**A. Night boundary**
1. Void right before bed is **excluded** from NUV.
2. First morning void (within 30 min of rising) is **included** in NUV.
3. First morning void adds to NUV volume but does **not** increment the nocturia count.
4. A void at 02:00 is attributed to the correct `nightId` even though the calendar date has rolled over.
5. **DST spring-forward** night: nocturnal duration and attribution stay correct across the skipped hour.
6. **DST fall-back** night: the repeated hour doesn't double-count or misattribute.

**B. Nocturnal polyuria index**
7. NPi = NUV / 24h volume for a fully measured window.
8. NPi is **withheld** (not zero, not guessed) when any contributing void lacks a real volume.
9. Ratio is flagged against the 0.33 threshold **without** emitting a diagnosis; age-dependence noted, not hard-coded.

**C. Volume & quality**
10. `weighed`: wet grams − dry grams → mL at 1 g ≈ 1 mL.
11. `estimated` stores a range and never masquerades as a measured number.
12. A report built from mixed-quality volumes surfaces the lowest quality present.

**D. Module registry**
13. Enabling a module adds exactly its questions/widgets/reports; disabling removes them; core untouched.
14. Two modules contributing to the same surface compose without collision.
15. Core composition respects the budget of 2 and `priority` ordering; overflow falls to the gateway.
16. An enuresis-only profile yields an **empty** daytime-void core (pure tap); a BPH+OAB profile yields a non-empty core within budget.
17. A question owned by two enabled modules appears once (dedup by `question.id`).
18. Quick-onboarding answers map to the expected enabled-module set; re-running onboarding edits the profile without deleting logged events.

**E. Report degradation (the failure-state rule)**
19. 11/13 measured voids → report renders, flagged incomplete, NPi handled per test 8.
20. Everyday-only data (no measured day ever) still yields a valid trend report.

**F. Traits vs events**
21. A trait value is never averaged into an event-series statistic.

---

## 10. Open decisions (your call)

1. **ICIQ-UI SF / OABSS scoring (§6.3):** I'll verify exact scoring before embedding; flag if you'd rather skip validated leak instruments and stay event-only.
2. **Reminders (§7.5):** planned as a morning catch-up rather than push notifications, given iOS PWA limits. Say if you want to attempt push anyway.

*Resolved:* platform, privacy, day+night scope, two-mode design, night-boundary/NPi rules, traits-vs-events, module registry, profile-composed core (budget 2, default priority, no pinning in v1), tiered re-runnable onboarding.

---

## 11. First build step

Per TDD: the very next action is writing the **failing night-boundary tests (§9 group A)** against the pure time model — no UI, no Firestore. It's the trickiest logic, it's a pure function, and it breaks naively at DST. We write A1–A6 red, then implement to green, then move to the NPi group.
