# Motive repository guidance

## Repository map

- `app/`: static Next.js interface and browser-only state.
- `data/exercises.json`: canonical movement library.
- `draft_sources/`: source notes; preserve them unless the user requests removal.
- `tests/`: data and emitted-site assertions.
- `scripts/check-release.mjs`: public-release scanner.
- `.agents/skills/`: reusable maintenance workflow.
- `.codex/agents/`: bounded review agents.

Read the nearest nested `AGENTS.md` before changing files in a subdirectory.

## Product invariants

- Keep all required behavior static and compatible with GitHub Pages.
- Browser AI is optional, explicit, on-device, and advisory. Never expose an API
  key or add a required cloud request to the client bundle.
- Store routine data only on the user's device unless a future request explicitly
  authorizes a backend design.
- Keep movement content cautious. Do not add diagnostic, rehabilitative, or
  guaranteed health claims.
- Preserve keyboard access, touch targets, mobile layout, and reduced-motion
  behavior.
- Do not add runtime CDN assets or model-authored SVG illustrations.

## Verification

```powershell
npm ci --ignore-scripts
npm run verify
npm run audit
```

For a release, build with the intended GitHub repository name when checking the
Pages base path:

```powershell
$env:GITHUB_ACTIONS = "true"
$env:GITHUB_REPOSITORY = "owner/repository"
npm run build:pages
Remove-Item Env:GITHUB_ACTIONS
Remove-Item Env:GITHUB_REPOSITORY
```

Do not weaken lint, type, test, audit, workflow, secret, or emitted-asset checks
to make a change pass. Pin third-party GitHub Actions to immutable commit SHAs.

## Definition of done

Source checks, static export, emitted-site tests, release scan, and dependency
audit pass. A public deployment is complete only after GitHub Actions succeeds
and the live Pages URL is checked for expected assets, console errors, and
unexpected requests.
