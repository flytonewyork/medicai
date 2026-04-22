# Shipping Anchor as an Android APK (TWA)

Anchor is a PWA. This guide wraps the live Vercel deploy in a **Trusted
Web Activity** so dad can install it from an APK on his Android phone
and it behaves like a native app — full-screen, own icon, own task in
the recents list. No rewrite: the Next.js code stays exactly as it is.

Two one-time steps on your machine, then the APK is yours to sideload
or publish.

## Prereqs

- **Node 18+** (already required for this repo)
- **JDK 17** — `brew install openjdk@17` on macOS, or install from
  https://adoptium.net/ — Bubblewrap needs `keytool` + `jarsigner`
- **Android SDK cmdline-tools** — Bubblewrap installs what it needs on
  first run, but have `$ANDROID_HOME` set to a writable dir (e.g.
  `~/Library/Android/sdk`). If you already use Android Studio it's
  wired up.
- **Bubblewrap CLI** — `npm install -g @bubblewrap/cli`

## One-time config

1. **Publish the production deploy.** Merge to `main`; wait for Vercel
   to mark the production deploy Ready. Note the domain (e.g.
   `anchor.yourdomain.com` or `<project>.vercel.app`). Everything below
   refers to it as `PROD_HOST`.

2. **Edit `twa-manifest.json`** in this repo: replace every occurrence
   of `REPLACE_WITH_VERCEL_PROD_HOST` with `PROD_HOST` (no protocol).
   Don't commit the populated file to a public branch if `PROD_HOST` is
   a private sub-domain — the committed version uses placeholders on
   purpose.

3. **Run bubblewrap init** in the repo root. It reads
   `twa-manifest.json` and scaffolds an Android Gradle project at
   `./android/`:

   ```bash
   bubblewrap init --manifest=twa-manifest.json --directory=./android
   ```

   When it asks about signing, pick "Create new key". Save the keystore
   (`android/android.keystore`) + passwords somewhere you won't lose —
   losing the keystore means you can never ship an update under the
   same package id.

4. **Extract the SHA-256 fingerprint** of the keystore:

   ```bash
   keytool -list -v -keystore android/android.keystore -alias android \
     | grep 'SHA256:'
   ```

   Copy the colon-separated hex value (e.g.
   `AA:BB:CC:DD:…`). Upper-case hex is fine.

5. **Wire the fingerprint into Vercel.** Production env vars
   (Project → Settings → Environment Variables → Production):

   ```
   TWA_PACKAGE_NAME=app.vercel.anchor
   TWA_SHA256_FINGERPRINTS=AA:BB:CC:DD:…
   ```

   Save and **redeploy** main (Vercel → Deployments → ⋯ → Redeploy).
   The `/.well-known/assetlinks.json` route now emits the right
   fingerprint; Chrome's verifier on the phone will green-light the
   TWA.

6. **Sanity-check** the deployed file in a browser:

   ```
   https://PROD_HOST/.well-known/assetlinks.json
   ```

   It should return a non-empty JSON array containing your
   `package_name` and fingerprint. If it's an empty `[]`, the env vars
   didn't land — re-check Production scope.

## Build the APK

From the repo root:

```bash
cd android
bubblewrap build
```

Bubblewrap produces:

- `app-release-signed.apk` — sideload-ready, what you send to dad
- `app-release-bundle.aab` — Play Store upload artefact (optional)
- `assetlinks.json` — **do NOT** commit or upload; the Next.js route
  already serves it from env vars

## Install on dad's phone

Easiest sideload path:

1. Plug dad's phone in, USB debugging on (Settings → About →
   7 taps on Build number → Settings → System → Developer options →
   USB debugging).
2. `adb install android/app/build/outputs/apk/release/app-release-signed.apk`
3. First launch: because assetlinks are verified, the TWA opens
   fullscreen with no browser chrome. If the URL bar is still visible,
   step 6 above (sanity-check) probably came back empty.

No USB? Email or AirDrop the APK and open it on the phone — Android
will prompt "Install unknown apps" for the mail client.

## Iteration

For code changes, no APK rebuild is needed — TWA just loads the live
production URL. Dad's app updates the instant you push to `main`.

The only time you rebuild the APK is when:
- the icon, colors, package id, or app name change (edit
  `twa-manifest.json`, bump `appVersion`, run `bubblewrap update`
  then `bubblewrap build`)
- the signing key rotates (rare; update `TWA_SHA256_FINGERPRINTS` in
  Vercel **before** sending the new APK)

## Play Store (optional, next sprint)

The `.aab` Bubblewrap produces is Play-Store-ready. Publish via
`Play Console → Create app → Production → Upload`. Enable Play App
Signing; export the Play-signing cert's SHA-256 and **add it** to
`TWA_SHA256_FINGERPRINTS` (comma-separated with the upload key). Both
fingerprints must live there or devices installed via Play will fail
asset-link verification.

## Troubleshooting

- **URL bar shows inside the APK** → `/.well-known/assetlinks.json`
  empty or mismatched. Redeploy after setting env vars; verify in
  browser; clear Chrome's cache on the phone (`adb shell pm clear
  com.android.chrome`) — assetlinks are cached for ~5 min.
- **`keytool: command not found`** → `openjdk@17` not on `PATH`.
  `export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"`.
- **Update loop ("unknown package") after rotating the keystore** →
  you cannot change the signing key on an installed APK. Uninstall
  first, install new APK.
- **Supabase sign-in silently fails in the TWA** → Supabase's auth
  redirect must include your app's custom scheme OR the same HTTPS
  redirect you use on the web. We use email/password only, so this
  doesn't bite us today, but keep it in mind if OAuth lands.
