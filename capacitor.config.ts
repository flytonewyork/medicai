import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wraps Anchor's Next.js app as a native iOS shell focused on the
// carer experience. The WebView points at the deployed web app because the
// AI-ingest API routes require a Node server — shipping the app fully offline
// would mean losing Claude-backed parsing. Local-first for PHI is unchanged:
// Dexie still stores every patient record on-device in the WebView.
//
// Override the URL at build time with CAPACITOR_SERVER_URL for staging /
// local-network testing (e.g. pointing a simulator at a Mac's LAN IP on
// port 3000). `allowNavigation` keeps the WebView on the production origin
// and blocks drive-by navigations from parsed markdown.
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? "https://anchor.thomashu.com/family";

const config: CapacitorConfig = {
  appId: "app.anchor.carer",
  appName: "Anchor Carer",
  // webDir is required by Capacitor but unused when server.url is set —
  // point it at the Next.js build output so `cap copy` during a future
  // offline-capable build still works without extra config.
  webDir: ".next",
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation: [
      "anchor.thomashu.com",
      "*.vercel.app",
    ],
  },
  ios: {
    // Status bar overlays the WebView so the PWA's viewport-fit=cover layout
    // can flow safely behind the notch. The Safari full-screen tweaks in
    // layout.tsx + globals.css handle the inset padding.
    contentInset: "never",
    scrollEnabled: true,
  },
};

export default config;
