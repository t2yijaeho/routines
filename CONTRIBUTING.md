# Contributing

Thank you for improving Motive.

## Before opening a pull request

1. Keep the runtime fully static and usable without browser AI.
2. Add movement data to `data/exercises.json`; do not bury library content in a
   component.
3. Include a concise movement cue and a conservative starting prescription.
4. Preserve keyboard operation, visible focus, mobile layout, and the
   `prefers-reduced-motion` fallback.
5. Never put credentials, analytics, remote scripts, or a required API call in
   the public bundle.
6. Run the complete gate:

```powershell
npm ci --ignore-scripts
npm run verify
npm run audit
```

Do not weaken a check to make a change pass. Explain any safety-sensitive
movement content or new dependency in the pull request.

## Movement and interface changes

Each movement needs an identifiable preview that agrees with its written cue.
Test animations at rest and in motion; stop offscreen work and respect the
user's reduced-motion setting. Do not add diagnostic or rehabilitative claims.
Use bundled assets and established icons; do not add remote fonts, CDN scripts,
or model-authored SVG illustrations.

Keep routine validation and sequencing in `lib/` so persisted input and session
steps have a single source of truth. Check storage errors, empty routines,
per-side prescriptions, and timer transitions when changing this logic. A timer
finishing must not automatically start the next exercise.

Before publication, validate the intended repository base path and check the
deployed site after both workflows pass. Confirm the movement library, editing,
saved routines, session player, narrow layouts, and keyboard access in a real
browser.
