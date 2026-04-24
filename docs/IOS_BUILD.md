# iOS carer-app build

Anchor's iOS shell is a Capacitor wrapper around the deployed Next.js app,
scoped to the carer experience (`/family`). The WebView loads a remote URL
because the AI-ingest API routes (`/api/parse-appointment`,
`/api/ai/ingest-*`) require a Node server — Dexie + local-first PHI handling
are unchanged inside the WebView.

## Prerequisites (macOS only)

- Xcode 15 or newer (`xcode-select --install` for command-line tools)
- [CocoaPods](https://cocoapods.org): `sudo gem install cocoapods`
- Node 24.x + pnpm 10
- A paid Apple Developer account for TestFlight / App Store distribution

## First-time setup

```bash
pnpm install
# Generate the ios/ native project. Creates ios/App/App.xcworkspace + Podfile
# and pins the remote URL from capacitor.config.ts. Run once per clone.
pnpm ios:init
# Copy web assets + native plugins into the ios/ project. Run after every
# capacitor.config.ts change or dependency bump.
pnpm ios:sync
# Open the workspace in Xcode.
pnpm ios:open
```

## Day-to-day

The remote-URL mode means most changes don't need an iOS rebuild — edit the
Next.js app, deploy, and the shipped carer app reloads against production.
Rebuild the iOS binary when any of:

- `capacitor.config.ts` changes (server URL, allow-list, native options)
- A Capacitor plugin is added / updated
- App icon / splash assets change

```bash
pnpm ios:sync         # refresh native project
pnpm ios:open         # Archive → upload to App Store Connect in Xcode
```

## Environment overrides

`CAPACITOR_SERVER_URL` swaps the WebView target at sync time. Examples:

```bash
# Staging preview
CAPACITOR_SERVER_URL="https://anchor-staging.vercel.app/family" pnpm ios:sync

# Local Mac serving to a Simulator on the same host
CAPACITOR_SERVER_URL="http://localhost:3000/family" pnpm ios:sync
```

The `cleartext: false` flag stays on — for localhost testing, use Safari's
Develop → Device menu rather than flipping the flag.

## Deploying

1. Archive in Xcode (Product → Archive)
2. Validate the archive against App Store Connect
3. Upload → TestFlight for internal testing (Thomas + immediate family)
4. Submit for external review when ready — medical-data apps need the
   HIPAA / privacy-nutrition-label disclosures filled in on the Apple
   side; no PHI leaves the device so the disclosures are shorter than a
   server-backed app.

## Why not a pure PWA?

The web app is fully installable via Safari's **Share → Add to Home Screen**
— `manifest.webmanifest` + `apple-mobile-web-app-status-bar-style:
black-translucent` + safe-area padding are in place. The Capacitor wrapper
adds:

- App Store distribution (family members can install from a link, not a
  per-device share-sheet flow)
- Push notifications outside of iOS's PWA push sandbox (better reliability)
- Native share-sheet integration for photos of lab letters
- A stable home-screen icon + splash screen per App Store guidelines

Pick whichever fits the carer's comfort level — both hit the same Dexie
database once opened.
