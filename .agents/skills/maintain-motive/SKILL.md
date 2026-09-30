---
name: maintain-motive
description: Maintain, verify, secure, and publish the Motive static routine builder and GitHub Pages release.
---

# Maintain Motive

Keep the movement library, builder, optional browser-AI boundary, tests, and
public deployment aligned as one static release surface.

## Workflow

1. Read the root and nearest scoped `AGENTS.md` files.
2. Update canonical movement data in `data/exercises.json` and preserve source
   notes in `draft_sources/`.
3. Keep all baseline features independent of `window.LanguageModel`; AI use must
   begin with explicit user activation and remain advisory.
4. Preserve GitHub Pages base-path handling, `.nojekyll`, local-only assets,
   accessibility, responsive behavior, and reduced-motion behavior.
5. Run `npm ci --ignore-scripts`, `npm run verify`, and `npm run audit`.
6. Request the repository review agents for focused release and accessibility
   reviews before publication.

## Release invariants

- No API key, remote script, required network request, server route, or runtime
  CDN is present in the exported site.
- Every movement has a unique ID, category, cue, positive prescription, and time
  estimate.
- GitHub Actions use minimum permissions and immutable commit SHAs.
- Report a release as live only after CI, Pages deployment, and live browser
  verification all pass.
