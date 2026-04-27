import type { LocalizedText } from "~/types/localized";

// Ethical will — guided composition scaffold.
//
// Traditional form: values, hopes, blessings, apologies, what to carry
// forward. Jewish 'tzava'a' and Chinese 家训/家書 are the two closest
// antecedents. Modern secular guides borrow from both.
//
// This module provides the section structure used by the UI. The
// patient composes; the app never generates ethical-will content. Sections
// are presented one at a time with a gentle prompt; responses become
// the body of a sealed entry (see sealed.ts).
//
// See docs/LEGACY_MODULE.md §"Tier 1 — Ethical will".

export interface EthicalWillSection {
  key: string;
  title: LocalizedText;
  prompt: LocalizedText;
  example?: LocalizedText;
  optional?: boolean;
}

export const ETHICAL_WILL_SECTIONS: EthicalWillSection[] = [
  {
    key: "values",
    title: {
      en: "What I believe to be most important",
      zh: "我认为最重要的事",
    },
    prompt: {
      en: "What values have shaped your life? What principles would you most want your family to carry forward?",
      zh: "哪些价值观塑造了您的一生?您最希望家人延续下去的,是哪些?",
    },
  },
  {
    key: "gratitude",
    title: {
      en: "What I'm grateful for",
      zh: "我心怀感激的",
    },
    prompt: {
      en: "Name people, places, and moments that have given you joy. Do not worry about being comprehensive.",
      zh: "写下给过您快乐的人、地方、时刻。不必求全。",
    },
  },
  {
    key: "blessings",
    title: {
      en: "Blessings and hopes",
      zh: "祝愿与盼望",
    },
    prompt: {
      en: "What do you wish for Catherine, Thomas, and any grandchildren who may come? For each person, one or two lines is enough.",
      zh: "您为妈妈、托马斯、以及可能到来的孙辈,有什么样的祝愿?每一位,一两句就够。",
    },
  },
  {
    key: "wisdom",
    title: {
      en: "What I've learned that I'd want known",
      zh: "我愿意让后人知晓的感悟",
    },
    prompt: {
      en: "What do you know now that took a lifetime to learn? What would you want to say to someone at the start of their life?",
      zh: "您现在明白的、花了一辈子才学到的,是什么?如果您要对一个刚刚起步的人说一句话,您会说什么?",
    },
  },
  {
    key: "apologies",
    title: {
      en: "What I wish I had done differently",
      zh: "我希望当初另作选择的事",
      zh_fallback: "我希望当初另作选择的事",
    } as LocalizedText,
    prompt: {
      en: "Are there apologies you'd like to offer, or things you'd wish to have done differently? Write only what you want to.",
      zh: "有哪些您想表达的歉意,或者希望当初另作选择的事?只写您愿意写的。",
    },
    optional: true,
  },
  {
    key: "forgiveness",
    title: {
      en: "What I forgive",
      zh: "我所原谅的",
    },
    prompt: {
      en: "Is there anyone you'd like to forgive, or be forgiven by?",
      zh: "您想原谅谁,或希望被谁原谅?",
    },
    optional: true,
  },
  {
    key: "practice",
    title: {
      en: "What has kept me well",
      zh: "让我安住的",
    },
    prompt: {
      en: "What spiritual or practical habits have kept you well? What would you want the family to try when they are struggling?",
      zh: "是哪些修行或日常习惯让您安住?当家人感到疲惫时,您希望他们尝试什么?",
    },
  },
  {
    key: "closing",
    title: {
      en: "Closing words",
      zh: "落款",
    },
    prompt: {
      en: "Anything that hasn't fit into the sections above. A line, a phrase, a name.",
      zh: "上面没能写下的任何话。一句话、一个短语、或者只是一个名字。",
    },
  },
];

/** Compose all section responses into a single ethical-will body. */
export function composeEthicalWill(
  responses: Record<string, string>,
  locale: "en" | "zh",
): string {
  const lines: string[] = [];
  for (const section of ETHICAL_WILL_SECTIONS) {
    const body = responses[section.key]?.trim();
    if (!body) continue;
    lines.push(`## ${section.title[locale]}`);
    lines.push("");
    lines.push(body);
    lines.push("");
  }
  return lines.join("\n").trim();
}
