# Android Build

The Android Capacitor target wraps the Next.js web app as a native shell so
Anchor can run on Hu Lin's Android phone with Health Connect access. The web
WebView still points at the deployed origin (`https://anchor.thomashu.com/family`)
because the AI-ingest API routes need a Node server.

## What's in the repo

- `android/` — the Capacitor Android project (Gradle, AndroidManifest, MainActivity)
- `src/lib/wearable/native-client.ts` — TypeScript adapter over `capacitor-health-connect`
- `src/lib/wearable/client.ts` — runtime factory (Native on Android, Unavailable elsewhere)
- `src/components/settings/wearable-section.tsx` — patient-facing connect flow

## Required dev tooling (one-time)

- Android Studio Hedgehog or later (or Android SDK CLI tools)
- Java 17 (Capacitor 8 requires it)
- A physical Android device or emulator with Health Connect installed
  - Install Health Connect from the Play Store on the patient's phone
  - On API 34+ devices, Health Connect ships with the OS

## Build & run

```bash
pnpm install              # makes sure capacitor-health-connect + @capacitor/android are installed
pnpm build                # build the Next.js web bundle
npx cap sync android      # copy web bundle + plugin metadata into android/app/src/main/assets
npx cap open android      # opens in Android Studio
```

Then in Android Studio:
1. Connect a physical Android device with USB debugging on, or start an emulator
2. Click Run

## Health Connect on the device

The patient grants per-data-type permissions through Health Connect's chooser,
not through the standard Android permission prompts. Flow:

1. Open the Anchor app → Settings → Wearable section
2. Tap "Link Health Connect"
3. The Health Connect chooser opens listing each metric we requested
4. The patient toggles which data types Anchor can read
5. Returning to Anchor, the section shows which metrics are linked

The patient can revoke permissions any time in Health Connect's own settings.
The Anchor app does not store any wearable data centrally; readings land in the
device's Dexie store via the on-device sync logic in `src/lib/wearable/sync.ts`.

## Supported metrics (current plugin v0.7.0)

The `capacitor-health-connect` plugin covers:

- Resting heart rate
- Oxygen saturation
- Steps
- Active calories burned
- Weight
- Body fat percentage
- Body temperature

**Not yet supported** (deferred to a plugin extension PR):

- Heart rate variability (RMSSD) — Health Connect's `HeartRateVariabilityRmssd`
  record type exists but the plugin hasn't wired it
- Sleep (`SleepSession`) — same reason

The `WearableMetricKind` taxonomy in `src/types/wearable.ts` already includes
HRV and sleep so adding plugin support is internal-only — no consumer code
changes once the plugin extension lands.

## Pairing the Oura ring

1. Install the Oura app on the patient's Android phone
2. Pair the ring via the Oura app
3. In the Oura app: Settings → Apps → Health Connect → enable data sharing
4. In Anchor: Settings → Wearable → Link Health Connect → grant the metrics
   we request
5. From here, the Oura app publishes nightly readings to Health Connect and
   Anchor's daily background sync pulls them into the analytical layer

The same flow works for Withings, Garmin, Samsung Health, or any other Health
Connect-publishing app — Anchor doesn't bind to a specific vendor.

## Privacy posture

- No wearable data leaves the device unless the patient is signed in to a
  household and the household sync is enabled
- Health Connect is a local-on-device data layer; values traverse the vendor
  cloud only via the source app (Oura, Withings) — Anchor never sees them
  off-device
- The Health Connect chooser is the only path to grant or revoke; there's no
  silent refresh of permissions
