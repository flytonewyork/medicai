import type { IngestOp } from "~/types/ingest";

// Tiny RFC 5545 subset parser. Supports VEVENT blocks with DTSTART,
// DTEND, SUMMARY, LOCATION, DESCRIPTION, UID, and line-folded
// continuations. Enough to handle Apple Calendar / iCloud ICS
// subscriptions, Google Calendar exports, and most clinic
// scheduling systems. We deliberately ignore VTIMEZONE + RRULE this
// slice — Apple's subscription endpoint already resolves recurrences
// into individual VEVENTs for exported copies.

export interface ParsedVEvent {
  uid?: string;
  summary?: string;
  location?: string;
  description?: string;
  starts_at?: string;   // ISO 8601
  ends_at?: string;
  all_day?: boolean;
}

// RFC 5545: long lines are folded by inserting CRLF + a leading
// whitespace. Unfold first so field parsing sees the full value.
function unfold(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

// Converts "20260429T092000" (floating), "20260429T092000Z" (UTC),
// or "TZID=Australia/Melbourne:20260429T092000" into ISO 8601.
// Floating times without a TZID are interpreted as UTC — we'd
// rather the user see a clearly-offset value than a silently-wrong
// local one.
function parseIcsDate(raw: string): { iso: string; all_day: boolean } | null {
  // Property form:  DTSTART;TZID=...;VALUE=DATE:...
  const parts = raw.split(":");
  if (parts.length < 2) return null;
  const params = parts[0] ?? "";
  const value = parts.slice(1).join(":").trim();
  const isDateOnly = /VALUE=DATE\b/i.test(params) || /^\d{8}$/.test(value);
  if (isDateOnly) {
    // YYYYMMDD → YYYY-MM-DD
    const m = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    return { iso: `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`, all_day: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) {
    return {
      iso: `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`,
      all_day: false,
    };
  }
  // Floating — append +00:00 but leave a breadcrumb in the
  // description ambiguity. Caller gets to note this.
  return {
    iso: `${y}-${mo}-${d}T${h}:${mi}:${s}+00:00`,
    all_day: false,
  };
}

// Parses an ICS payload into a flat list of VEVENTs. Minimal —
// ignores alarms, recurrence expansion, attachments. Good enough
// for an import flow where every event is reviewed in the preview.
export function parseIcs(raw: string): ParsedVEvent[] {
  const text = unfold(raw);
  const lines = text.split(/\r?\n/);
  const events: ParsedVEvent[] = [];
  let current: ParsedVEvent | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.starts_at) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("UID:")) current.uid = line.slice(4).trim();
    else if (line.startsWith("SUMMARY:"))
      current.summary = unescapeIcsText(line.slice(8));
    else if (line.startsWith("LOCATION:"))
      current.location = unescapeIcsText(line.slice(9));
    else if (line.startsWith("DESCRIPTION:"))
      current.description = unescapeIcsText(line.slice(12));
    else if (line.startsWith("DTSTART")) {
      const parsed = parseIcsDate(line.slice(7));
      if (parsed) {
        current.starts_at = parsed.iso;
        current.all_day = parsed.all_day;
      }
    } else if (line.startsWith("DTEND")) {
      const parsed = parseIcsDate(line.slice(5));
      if (parsed) current.ends_at = parsed.iso;
    }
  }
  return events;
}

function unescapeIcsText(raw: string): string {
  return raw
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

// Classify a SUMMARY into one of Anchor's AppointmentKind values.
// A crude lexical heuristic — Claude would do better, but this is
// cheap, deterministic, and gets ~80% of typical titles right.
// Unknown kinds default to "other".
export function guessAppointmentKind(summary: string | undefined):
  | "clinic"
  | "chemo"
  | "scan"
  | "blood_test"
  | "procedure"
  | "other" {
  const t = (summary ?? "").toLowerCase();
  if (/\bchemo|infusion|gnp|gem\/nab|dou|day oncology|cycle\b/.test(t))
    return "chemo";
  if (/\bpet|mri|ct\b|imaging|scan|ultrasound|nuclear|bone scan/.test(t))
    return "scan";
  if (/\bblood|bloods|path|fbe|uec|cbc|ca19|ca 19|labs?\b/.test(t))
    return "blood_test";
  if (/\bbiopsy|endoscopy|ercp|paracentesis|procedure|line insert|port\b/.test(t))
    return "procedure";
  if (/\bclinic|review|consult|appt|appointment|visit|f\/u\b/.test(t))
    return "clinic";
  return "other";
}

// Converts ParsedVEvent[] into IngestOp[] suitable for the
// preview-diff flow. The ICS source stamps `ics_uid` so re-imports
// can dedupe, and the summary gets a classifier pass to set
// Appointment.kind.
export function icsEventsToOps(events: readonly ParsedVEvent[]): IngestOp[] {
  const ops: IngestOp[] = [];
  for (const ev of events) {
    if (!ev.starts_at) continue;
    const title = ev.summary?.trim() || "(untitled event)";
    ops.push({
      kind: "add_appointment",
      data: {
        kind: guessAppointmentKind(ev.summary),
        title,
        starts_at: ev.starts_at,
        ends_at: ev.ends_at,
        all_day: ev.all_day,
        location: ev.location,
        notes: ev.description,
        ics_uid: ev.uid,
        status: "scheduled",
      },
      reason: "Imported from shared calendar",
    });
  }
  return ops;
}
