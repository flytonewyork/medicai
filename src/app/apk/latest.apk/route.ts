import manifest from "../../../../public/apk/manifest.json";

// Stable share URL — anchor.thomashu.com/apk/latest.apk — that always
// 302-redirects to the current latest build. Send this link out; the
// recipient never has to know which version is current.
//
// 404 when the manifest has no published release yet (CI hasn't run, or
// the publish script hasn't been called locally). The /apk landing page
// already explains how to fix that.

type Manifest = {
  latest: string | null;
  releases: { version: string; filename: string }[];
};

const data = manifest as Manifest;

export const runtime = "nodejs";
// Recompute on each deploy — the manifest is bundled at build time, so
// dynamic doesn't buy us live updates anyway.
export const dynamic = "force-static";

export function GET() {
  if (!data.latest) {
    return new Response("No APK published yet.", {
      status: 404,
      headers: { "cache-control": "public, max-age=60" },
    });
  }
  const release = data.releases.find((r) => r.version === data.latest);
  if (!release) {
    return new Response(
      "Manifest is inconsistent: latest version not found in releases.",
      { status: 500 },
    );
  }
  // Relative Location header — RFC 7231 §7.1.2 allows it and every modern
  // browser resolves it against the request URL. Avoids hard-coding the
  // production origin into a static route.
  return new Response(null, {
    status: 302,
    headers: {
      location: `/apk/${release.filename}`,
      "cache-control": "public, max-age=60",
    },
  });
}
