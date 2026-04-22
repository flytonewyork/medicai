import { NextResponse } from "next/server";

// Digital Asset Links for the Trusted Web Activity Android wrapper.
// Chrome validates this file before hiding its browser chrome inside the
// APK. The TWA build will break silently (fall back to a visible URL bar)
// if the fingerprint or package name is wrong.
//
// Config comes from Vercel env so we can rotate the keystore without
// shipping code. Set these in Vercel → Project → Settings → Environment
// Variables for Production:
//
//   TWA_PACKAGE_NAME          e.g. app.vercel.anchor
//   TWA_SHA256_FINGERPRINTS   comma-separated SHA-256 fingerprints of the
//                             APK signing key, in the 64-hex-with-colons
//                             format (`keytool -list -v` → "SHA256: …")
//                             Multiple fingerprints support upload + play
//                             app signing coexistence.
//
// Without both env vars present the route returns an empty 200 response —
// a live production deploy will still serve the PWA; only the TWA-APK
// path silently regresses to "browser-looking" mode. See DEPLOY-ANDROID.md
// for the one-time setup walk-through.

export const runtime = "nodejs";
// Static-at-build so Chrome's short-lived cache doesn't pin a stale value
// after an env-var change — a redeploy is what pushes the new asset list.
export const dynamic = "force-static";

export function GET() {
  const packageName = process.env.TWA_PACKAGE_NAME;
  const fingerprints = (process.env.TWA_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (!packageName || fingerprints.length === 0) {
    return NextResponse.json([], {
      headers: { "cache-control": "public, max-age=300" },
    });
  }

  return NextResponse.json(
    [
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
          "delegate_permission/common.get_login_creds",
        ],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      // Chrome caches assetlinks briefly. Five minutes balances rotation
      // freshness vs. per-launch fetch cost.
      headers: { "cache-control": "public, max-age=300" },
    },
  );
}
