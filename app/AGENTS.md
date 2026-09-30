# Interface guidance

- Keep `page.tsx` browser-safe and statically exportable. Do not add server
  actions, API routes, cookies, authentication, or environment-dependent UI.
- Treat `data/exercises.json` as the component-library source of truth.
- New animation classes must have a useful visual loop and stop under
  `prefers-reduced-motion: reduce`.
- Interactive controls need an accessible name, visible focus, and a keyboard
  path. Reordering and removal cannot rely on drag gestures alone.
- Render model output as text. Never inject browser-AI output as HTML and never
  apply it to the routine without an explicit user action.
- Persist only device-local routine preferences under the versioned storage key.
