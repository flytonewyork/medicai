import { describe, it, expect } from "vitest";
import {
  SOURCES,
  formatCitation,
  getSource,
  type Citation,
} from "~/lib/nutrition/sources";

describe("nutrition source registry", () => {
  it("exposes the JPCC 2021 guide as the canonical local source", () => {
    const jpcc = SOURCES.jpcc_2021;
    expect(jpcc).toBeDefined();
    expect(jpcc.short_label).toMatch(/JPCC|Jreissati/i);
    expect(jpcc.full_citation).toMatch(/Jreissati Family Pancreatic Centre/);
    expect(jpcc.author).toMatch(/Ryan Surace/);
    expect(jpcc.url).toMatch(/^https?:\/\//);
    expect(jpcc.contact).toMatch(/03 9426 8880/);
    expect(jpcc.year).toBe(2021);
  });

  it("includes the three references the JPCC guide itself cites", () => {
    expect(SOURCES.hendifar_2019).toBeDefined();
    expect(SOURCES.mueller_2014).toBeDefined();
    expect(SOURCES.gartner_2016).toBeDefined();
  });

  it("includes the keto-strategy papers cited on /nutrition/guide", () => {
    expect(SOURCES.wolpin_2009).toBeDefined();
    expect(SOURCES.cohen_2018).toBeDefined();
  });

  it("getSource returns by id", () => {
    expect(getSource("jpcc_2021").short_label).toMatch(/JPCC|Jreissati/i);
  });
});

describe("formatCitation", () => {
  const c: Citation = { source_id: "jpcc_2021", page: 19 };

  it("renders short label with page when page is present", () => {
    const out = formatCitation(c, "en");
    expect(out).toMatch(/JPCC|Jreissati/i);
    expect(out).toMatch(/p\.\s*19/);
  });

  it("renders short label without page when page is absent", () => {
    const out = formatCitation({ source_id: "jpcc_2021" }, "en");
    expect(out).toMatch(/JPCC|Jreissati/i);
    expect(out).not.toMatch(/p\.\s*\d/);
  });

  it("renders Chinese-friendly form when locale is zh", () => {
    const out = formatCitation(c, "zh");
    // either 第19页 or p.19 form is fine — just must include the page number
    expect(out).toMatch(/19/);
  });
});
