# Privacy Model

## Principle

Medical data never leaves the device unless the user explicitly chooses to
export it.

## MVP architecture

- All data in browser IndexedDB on each user's device
- No server, no API, no cloud
- No analytics, no telemetry, no third-party error logging
- No PHI in URL parameters, logs, or session storage
- No external fonts that could fingerprint
- No third-party JS beyond bundled dependencies

## Multi-device coordination (MVP)

Manual: JSON export / import between devices via encrypted file transfer
(Signal, encrypted USB). Explicit user action required.

## Phase 2: optional encrypted sync

- End-to-end encryption with user-held key
- Zero-knowledge server (plaintext never seen server-side)
- Explicit opt-in per device
- Local-only mode remains default

## Threat model

Protect against: data breach of any third party, network interception,
third-party analytics, accidental PHI leakage in URLs / logs.

Do not protect against: physical device compromise, targeted attack on the
user's device, malicious browser extensions, screen recording by other apps.

## Deployment considerations

If deployed to Vercel:
- Password protection via Vercel Authentication
- No server-side logging of request bodies
- No analytics integrations
- Static export preferred where possible
