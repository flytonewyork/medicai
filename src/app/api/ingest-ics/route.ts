import { NextResponse } from "next/server";
import { icsEventsToOps, parseIcs } from "~/lib/ingest/ics";
import type { IngestDraft } from "~/types/ingest";

export const runtime = "nodejs";
// ICS import fetches a remote webcal URL server-side (sometimes slow iCloud
// feeds with many years of events) and runs regex parsing over the result.
// 60s is generous for network + parse.
export const maxDuration = 300;

// Server-side ICS fetcher. The browser can't fetch a webcal:// URL
// cross-origin; we do it server-side, normalise the scheme, parse
// VEVENTs, and return an IngestDraft the existing PreviewDiff can
// render. Supports three input modes:
//   { url: "webcal://p55-calendars.icloud.com/..." }
//   { url: "https://p55-calendars.icloud.com/..." }
//   { text: "<raw ICS payload>" }

interface RequestBody {
  url?: string;
  text?: string;
  // Patient's home IANA timezone; used as the fallback when a VEVENT
  // has a floating DTSTART (no TZID, no Z suffix). Defaults to
  // Australia/Melbourne for this install.
  fallbackTimezone?: string;
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("webcal://")) {
    return "https://" + trimmed.slice("webcal://".length);
  }
  return trimmed;
}

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let raw: string | null = null;
  let sourceHint = "pasted ICS text";
  if (body.text && body.text.trim().length > 0) {
    raw = body.text;
  } else if (body.url && body.url.trim().length > 0) {
    const url = normaliseUrl(body.url);
    try {
      const res = await fetch(url, {
        headers: { accept: "text/calendar, text/plain;q=0.9, */*;q=0.5" },
        redirect: "follow",
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Upstream returned ${res.status}` },
          { status: 502 },
        );
      }
      raw = await res.text();
      sourceHint = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: `Couldn't fetch calendar: ${message}` },
        { status: 502 },
      );
    }
  } else {
    return NextResponse.json(
      { error: "Provide `url` or `text`." },
      { status: 400 },
    );
  }

  // Sanity — ICS files always open with BEGIN:VCALENDAR.
  if (!raw.includes("BEGIN:VCALENDAR")) {
    return NextResponse.json(
      { error: "Response didn't look like an ICS calendar feed." },
      { status: 422 },
    );
  }

  const events = parseIcs(raw, body.fallbackTimezone);
  if (events.length === 0) {
    return NextResponse.json(
      { error: "No VEVENT blocks found." },
      { status: 422 },
    );
  }

  const ops = icsEventsToOps(events);
  const draft: IngestDraft = {
    source: "paste",
    detected_kind: "appointment_email",
    summary: `Imported ${events.length} event${
      events.length === 1 ? "" : "s"
    } from ${sourceHint}.`,
    ops,
    ambiguities: [],
    confidence: "medium",
  };
  return NextResponse.json({ draft });
}
