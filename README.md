# Motive

Motive is a movement studio: explore an animated library, build a routine, and
follow it one set at a time. It covers strength, flexibility, isometric work, and
cardio. Plans stay on your device, without an account or backend.

The repository is designed for a public GitHub release and deployment through
GitHub Pages.

## What is included

- 35 movements, with written cues, equipment, difficulty, and conservative
  starting prescriptions. Original notes are retained in `draft_sources/`.
- Movement-specific animated human figures drawn locally on canvas, with paused
  previews and reduced-motion support.
- Search, category, equipment, and level filters to find appropriate movements.
- A routine builder with ordering, editable sets, repetitions or time, recovery
  intervals, session estimates, presets, and clipboard export.
- A session player with self-paced repetitions, timed holds and recovery, pause,
  reset, previous, and skip controls. You decide when to advance to the next step.
- Device-local saved routines through `localStorage`.
- An optional Chrome Prompt API review that uses an on-device model when the
  browser exposes it. No API key or cloud fallback is included.
- Static export, locked dependencies, tests, a release scanner, CI, and an
  immutable-action GitHub Pages workflow.
- Self-hosted Inter typography and bundled Lucide icons. No runtime CDN assets.

## Build and follow a session

Start from a preset or select movements from the library. Open a movement to
read its cue and see the illustration before adding it. In the builder, adjust
the prescription and recovery for each movement, then reorder the routine with
the keyboard-accessible controls. Save it locally or copy the plan as text.

Starting a session opens the player. Timed steps count down when you begin;
repetition steps are self-paced. Complete both sides of a bilateral prescription
before advancing. Timers never move you into the next exercise automatically.
Movement illustrations are orientation aids; use the written cues and appropriate
instruction for technique.

## Run locally

Node.js 24 is recommended; Node.js 22.13 or newer is required.

```powershell
npm ci --ignore-scripts
npm run dev
```

Open `http://localhost:3000`.

Run the complete local release gate with:

```powershell
npm run verify
npm run audit
```

The static site is exported to `out/` by `npm run build`.

The source tests cover movement data, routine validation and persistence,
presets, estimates, and session steps. The emitted-site tests inspect accessible
landmarks, repository-prefixed asset paths, and the existence of every linked
asset. The release scanner additionally checks pinned Actions, private files,
tracked build artifacts, credentials, and remote runtime assets.

## Publish with GitHub Pages

1. Create a public GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The `Deploy GitHub Pages` workflow validates and publishes `out/` on every
   push to `main`.

The build detects project repositories such as `owner/routines` and applies the
`/routines` base path automatically. User or organization sites ending in
`.github.io` are exported at the root path.

To validate the project path locally in PowerShell:

```powershell
$env:GITHUB_ACTIONS = "true"
$env:GITHUB_REPOSITORY = "owner/routines"
npm run verify
Remove-Item Env:GITHUB_ACTIONS
Remove-Item Env:GITHUB_REPOSITORY
```

Publication is complete only when both CI and Pages workflows pass and the live
site has been checked for functioning controls, local assets, console errors,
and unexpected network requests. A successful local build alone is not a live
deployment.

GitHub Pages is a static host and does not apply custom HTTP security headers.
Motive therefore has no runtime backend, remote script, client credential, or
required API request. Do not add an API key to browser code or repository
secrets for this site.

## Optional browser AI

On compatible desktop Chrome installations, the builder checks for
`window.LanguageModel` and can ask the browser-managed on-device model for a
three-point structure review. Model creation only starts after the user presses
the review button; the regular builder remains available when the API or model
is unavailable. See Chrome's [Prompt API documentation](https://developer.chrome.com/docs/ai/prompt-api)
for current platform and model-download requirements.

If a model download is needed, the interface explains this before you start it.
The download is managed by the browser and may require several GB of storage and
network data. Once available, routine review runs on the device. AI output is
advisory text and never modifies the routine automatically.

## Your data

Saved routines live in this browser's local storage and do not sync between
devices. Clearing site data removes them. Copy a routine before clearing storage
if you want to keep a portable record. Motive does not include analytics,
advertising, accounts, remote training logs, or a required AI connection.

## Safety

Motive organizes training ideas; it does not diagnose conditions, prescribe
rehabilitation, or replace qualified instruction. Use pain-free ranges, scale
movements to your experience, and stop when movement causes pain. Inversions,
neck loading, and advanced unilateral work warrant appropriate coaching.

## Repository map

- `app/`: interface, player, motion previews, and browser-AI boundary.
- `lib/`: routine validation, persistence, presets, and session sequencing.
- `data/exercises.json`: movement component source of truth.
- `draft_sources/`: original working notes retained for provenance.
- `tests/`: library, routine behavior, and emitted-site checks.
- `scripts/check-release.mjs`: workflow, secret, and static-output release scan.
- `.agents/skills/` and `.codex/agents/`: durable maintenance and review guidance.

Contributions are welcome through pull requests. Read [CONTRIBUTING.md](CONTRIBUTING.md),
[SECURITY.md](SECURITY.md), and the [MIT license](LICENSE) first.
