import { describe, it, expect } from "vitest";
import { tagInput } from "~/lib/log/tag";

describe("log tagger — deterministic routing", () => {
  it("tags a protein entry as diet", () => {
    expect(tagInput("had 25g protein at breakfast")).toContain("diet");
  });

  it("tags neuropathy complaints as toxicity", () => {
    expect(tagInput("hands tingling more than yesterday")).toContain(
      "toxicity",
    );
  });

  it("co-tags a compound entry across multiple axes", () => {
    const tags = tagInput(
      "walked 30 minutes this morning, hands still numb",
    );
    expect(tags).toEqual(expect.arrayContaining(["physical", "toxicity"]));
  });

  it("tags lab shorthand as labs", () => {
    expect(tagInput("ANC was low on FBC yesterday")).toContain("labs");
  });

  it("tags chemo cycle mentions as treatment", () => {
    expect(tagInput("Got my gemcitabine dose on day 8")).toContain(
      "treatment",
    );
  });

  it("tags a mood complaint as mental", () => {
    expect(tagInput("feeling anxious about the next scan")).toEqual(
      expect.arrayContaining(["mental", "tumour"]),
    );
  });

  it("tags tumour-marker mentions", () => {
    expect(tagInput("CA19-9 came back higher")).toContain("tumour");
  });

  it("returns no tags for empty or irrelevant text", () => {
    expect(tagInput("")).toEqual([]);
    expect(tagInput("hello")).toEqual([]);
  });

  it("emits zh tags via Chinese cues", () => {
    expect(tagInput("手麻加重")).toContain("toxicity"); // 麻 → toxicity
    expect(tagInput("今天走路 30 分钟")).toContain("physical"); // 走路 → physical
  });
});
