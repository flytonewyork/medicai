import { describe, it, expect } from "vitest";
import {
  guessAppointmentKind,
  icsEventsToOps,
  parseIcs,
} from "~/lib/ingest/ics";

const ICS_SAMPLE = `BEGIN:VCALENDAR
PRODID:-//Apple Inc.//iOS 17.0//EN
VERSION:2.0
BEGIN:VEVENT
UID:abc-123@icloud.com
SUMMARY:Cycle 4 Day 1 infusion
LOCATION:Epworth Day Oncology\\, Level 2
DESCRIPTION:GnP cycle 4\\nArrive 15 minutes early.
DTSTART:20260513T090000Z
DTEND:20260513T140000Z
END:VEVENT
BEGIN:VEVENT
UID:abc-124@icloud.com
SUMMARY:PET CT restaging
LOCATION:Epworth Freemasons\\, East Melbourne
DTSTART;TZID=Australia/Melbourne:20260506T070000
DTEND;TZID=Australia/Melbourne:20260506T080000
END:VEVENT
BEGIN:VEVENT
UID:abc-125@icloud.com
SUMMARY:Weekly FBE + UEC
DTSTART;VALUE=DATE:20260512
END:VEVENT
END:VCALENDAR`;

describe("parseIcs", () => {
  it("extracts VEVENT blocks with all the fields we care about", () => {
    const events = parseIcs(ICS_SAMPLE);
    expect(events).toHaveLength(3);
    expect(events[0]!.uid).toBe("abc-123@icloud.com");
    expect(events[0]!.summary).toBe("Cycle 4 Day 1 infusion");
    expect(events[0]!.location).toBe("Epworth Day Oncology, Level 2");
    expect(events[0]!.description).toMatch(/Arrive 15 minutes early\./);
    expect(events[0]!.starts_at).toBe("2026-05-13T09:00:00.000Z");
    expect(events[0]!.ends_at).toBe("2026-05-13T14:00:00.000Z");
    expect(events[0]!.all_day).toBe(false);
  });

  it("flags DATE-only entries as all-day", () => {
    const events = parseIcs(ICS_SAMPLE);
    const fbe = events.find((e) => e.uid?.startsWith("abc-125"));
    expect(fbe).toBeDefined();
    expect(fbe!.all_day).toBe(true);
    expect(fbe!.starts_at).toBe("2026-05-12T00:00:00.000Z");
  });

  it("handles folded lines per RFC 5545", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:folded@example",
      "SUMMARY:A very long summary that",
      " continues on the next folded line",
      "DTSTART:20260513T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const [event] = parseIcs(raw);
    expect(event!.summary).toBe(
      "A very long summary thatcontinues on the next folded line",
    );
  });

  it("skips events with no DTSTART", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:no-date@example",
      "SUMMARY:This has no date",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseIcs(raw)).toHaveLength(0);
  });
});

describe("guessAppointmentKind", () => {
  it("picks 'chemo' for infusion / cycle / GnP titles", () => {
    expect(guessAppointmentKind("Cycle 4 Day 1 infusion")).toBe("chemo");
    expect(guessAppointmentKind("GnP weekly")).toBe("chemo");
    expect(guessAppointmentKind("DOU visit")).toBe("chemo");
  });

  it("picks 'scan' for PET / MRI / CT / imaging titles", () => {
    expect(guessAppointmentKind("PET CT restaging")).toBe("scan");
    expect(guessAppointmentKind("MRI liver")).toBe("scan");
    expect(guessAppointmentKind("Imaging follow-up")).toBe("scan");
  });

  it("picks 'blood_test' for pathology / FBE / CA19-9 titles", () => {
    expect(guessAppointmentKind("Weekly FBE + UEC")).toBe("blood_test");
    expect(guessAppointmentKind("CA 19-9")).toBe("blood_test");
  });

  it("picks 'procedure' for biopsy / ERCP / line titles", () => {
    expect(guessAppointmentKind("Liver biopsy")).toBe("procedure");
    expect(guessAppointmentKind("ERCP stent change")).toBe("procedure");
  });

  it("picks 'clinic' for review / consult / F/U", () => {
    expect(guessAppointmentKind("Oncology review")).toBe("clinic");
    expect(guessAppointmentKind("F/U with Dr Lee")).toBe("clinic");
  });

  it("falls back to 'other' for unrecognisable titles", () => {
    expect(guessAppointmentKind("Surprise event")).toBe("other");
    expect(guessAppointmentKind(undefined)).toBe("other");
  });
});

describe("icsEventsToOps", () => {
  it("emits one add_appointment op per VEVENT", () => {
    const events = parseIcs(ICS_SAMPLE);
    const ops = icsEventsToOps(events);
    expect(ops).toHaveLength(3);
    for (const op of ops) {
      expect(op.kind).toBe("add_appointment");
    }
  });

  it("classifies kinds from summaries", () => {
    const events = parseIcs(ICS_SAMPLE);
    const ops = icsEventsToOps(events);
    const kinds = ops.map((o) =>
      o.kind === "add_appointment" ? o.data.kind : undefined,
    );
    expect(kinds).toEqual(["chemo", "scan", "blood_test"]);
  });

  it("carries the ICS UID onto the data so re-imports can dedupe", () => {
    const events = parseIcs(ICS_SAMPLE);
    const ops = icsEventsToOps(events);
    for (const op of ops) {
      if (op.kind !== "add_appointment") continue;
      expect(op.data.ics_uid).toBeDefined();
    }
  });

  it("stamps the reason so the preview explains the source", () => {
    const [op] = icsEventsToOps(parseIcs(ICS_SAMPLE));
    expect(op).toBeDefined();
    if (op && "reason" in op) {
      expect(op.reason).toMatch(/shared calendar/i);
    }
  });
});
