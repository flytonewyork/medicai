import type { Appointment } from "~/types/appointment";
import { nowISO } from "~/lib/utils/date";

// Serialise the patient's Anchor schedule as RFC 5545 iCalendar text. The
// output is a one-shot snapshot — Anchor is local-first and appointments
// live in Dexie, so a hosted webcal:// subscription isn't possible without
// pushing PHI off-device. Users import the generated .ics once (Google:
// "Add calendar → From file"; Apple: double-click to merge into a chosen
// calendar). When new events are added, generate again.
//
// Escaping rules (RFC 5545 §3.3.11): backslash, semicolon, comma and
// newline are all backslash-escaped in TEXT fields. SUMMARY / LOCATION /
// DESCRIPTION all go through escapeText. DTSTAMP + DTSTART + DTEND are
// UTC basic-format (YYYYMMDDTHHMMSSZ); all-day variants use VALUE=DATE.

function escapeText(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

function formatUtc(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

// RFC 5545 §3.1: folded lines cap at 75 octets. Fold at 73 chars to leave
// room for CRLF and stay safely under the limit with ASCII-only content.
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    out.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest.length > 0) out.push(" " + rest);
  return out.join("\r\n");
}

function eventDescription(a: Appointment): string {
  const parts: string[] = [];
  if (a.doctor) parts.push(`Doctor: ${a.doctor}`);
  if (a.phone) parts.push(`Phone: ${a.phone}`);
  if (a.prep && a.prep.length > 0) {
    parts.push("Preparation:");
    for (const p of a.prep) parts.push(`• ${p.description}`);
  }
  if (a.notes && a.notes.trim().length > 0) {
    parts.push("");
    parts.push(a.notes.trim());
  }
  return parts.join("\n");
}

function eventBlock(a: Appointment, dtstamp: string): string[] {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  // UID must be globally unique + stable per appointment so re-imports
  // update rather than duplicate in the destination calendar.
  lines.push(`UID:anchor-${a.id ?? "noid"}@anchor.local`);
  lines.push(`DTSTAMP:${dtstamp}`);

  if (a.all_day) {
    lines.push(`DTSTART;VALUE=DATE:${formatDate(a.starts_at)}`);
    if (a.ends_at) {
      lines.push(`DTEND;VALUE=DATE:${formatDate(a.ends_at)}`);
    }
  } else {
    lines.push(`DTSTART:${formatUtc(a.starts_at)}`);
    // Default event length: 60 minutes when no end time is given. Keeps
    // the block visible in week views instead of collapsing to a point.
    const endIso =
      a.ends_at ?? new Date(new Date(a.starts_at).getTime() + 60 * 60_000).toISOString();
    lines.push(`DTEND:${formatUtc(endIso)}`);
  }

  lines.push(`SUMMARY:${escapeText(a.title)}`);
  if (a.location) lines.push(`LOCATION:${escapeText(a.location)}`);
  if (a.location_url) lines.push(`URL:${escapeText(a.location_url)}`);

  const desc = eventDescription(a);
  if (desc.length > 0) lines.push(`DESCRIPTION:${escapeText(desc)}`);

  // Cancelled / missed appointments are serialised so existing subscribers
  // see a cancelled status instead of a phantom meeting.
  if (a.status === "cancelled") lines.push("STATUS:CANCELLED");
  else if (a.status === "scheduled") lines.push("STATUS:CONFIRMED");

  lines.push("END:VEVENT");
  return lines;
}

export function appointmentsToIcs(
  appointments: readonly Appointment[],
  opts: { calendarName?: string } = {},
): string {
  const dtstamp = formatUtc(nowISO());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Anchor//Patient Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (opts.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeText(opts.calendarName)}`);
  }
  for (const a of appointments) {
    if (!a.starts_at) continue;
    lines.push(...eventBlock(a, dtstamp));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function triggerIcsDownload(ics: string, filename = "anchor-schedule.ics"): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
