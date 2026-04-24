import { describe, it, expect } from "vitest";
import { tagInput } from "~/lib/log/tag";
import { agentsForTags } from "~/agents/routing";

describe("tagger — legacy-module tags", () => {
  it("tags reminiscence cues as memory", () => {
    expect(tagInput("I remember the first time we went to Rotorua")).toContain("memory");
    expect(tagInput("Dad used to tell me about his village")).toContain("memory");
    expect(tagInput("小时候爸爸带我去散步")).toContain("memory");
  });

  it("tags gathering cues as social", () => {
    expect(tagInput("Let's have a family dinner on Saturday")).toContain("social");
    expect(tagInput("周末一起聚餐")).toContain("social");
  });

  it("tags cooking cues as cooking", () => {
    expect(tagInput("Dad's recipe for braised pork")).toContain("cooking");
    expect(tagInput("爸爸教我做菜")).toContain("cooking");
  });

  it("tags practice cues as practice", () => {
    expect(tagInput("Morning qigong routine")).toContain("practice");
    expect(tagInput("打坐十分钟")).toContain("practice");
  });
});

describe("routing — legacy tags do not fan out to clinical agents", () => {
  it("memory routes to no agents today (biographer arrives in slice 13)", () => {
    expect(agentsForTags(["memory"])).toEqual([]);
  });

  it("social routes to no agents today (orchestrator arrives in slice 15)", () => {
    expect(agentsForTags(["social"])).toEqual([]);
  });

  it("cooking / practice / legacy_voice / legacy_session all empty for now", () => {
    expect(agentsForTags(["cooking"])).toEqual([]);
    expect(agentsForTags(["practice"])).toEqual([]);
    expect(agentsForTags(["legacy_voice"])).toEqual([]);
    expect(agentsForTags(["legacy_session"])).toEqual([]);
  });

  it("mixing legacy + clinical tags only routes to the clinical side", () => {
    const agents = agentsForTags(["memory", "toxicity"]);
    expect(agents.sort()).toEqual(["clinical", "toxicity"].sort());
  });
});
