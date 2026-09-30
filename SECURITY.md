# Security policy

## Supported version

The current `main` branch is supported.

## Reporting a vulnerability

Use GitHub's **Private vulnerability reporting** feature on the repository's
Security page. Do not open a public issue for a suspected credential leak,
supply-chain problem, cross-site scripting path, or privacy issue.

Include the affected path, reproduction steps, expected impact, and any safe
mitigation you have identified. Please do not access data that is not yours or
disrupt a deployment while testing.

## Security model

Motive is a static application. It has no server, authentication, analytics,
cloud AI fallback, or client-side secret. Routine state stays in browser
storage and is validated before use. It is not encrypted or synced; other code
running on the same origin can access that storage. The optional Prompt API
boundary asks the browser's on-device model for advisory text and does not
transmit an API credential. An initial browser-managed model download can make
network requests, but routine review does not call a cloud AI service.

The release gate scans source and emitted assets for credential patterns,
runtime API references, local URLs, remote runtime assets, unpinned Actions,
tracked build artifacts, and accidentally published environment or private-key
files. Locked dependencies are audited in both CI and the Pages workflow.
