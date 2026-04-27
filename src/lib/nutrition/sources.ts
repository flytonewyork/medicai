import type { Locale } from "~/types/clinical";

// Source registry. Every nutrition claim the app surfaces — guide
// cards, feed nudges, food advisories, PERT prompts — carries one or
// more `Citation` objects pointing into here. The patient and family
// see "JPCC p. 19" pills that expand to the full reference + Ryan
// Surace's contact details, so the recommendation reads as the local
// clinical team's, not the app's.

export interface Source {
  id: string;
  short_label: string;
  full_citation: string;
  author?: string;
  url?: string;
  contact?: string;
  year?: number;
}

export const SOURCES = {
  // Local clinical guide (Epworth Richmond — same campus as the
  // hepatobiliary surgical service). Anchors every patient-facing
  // nutrition statement.
  jpcc_2021: {
    id: "jpcc_2021",
    short_label: "JPCC Nutrition Guide",
    full_citation:
      "Jreissati Family Pancreatic Centre at Epworth, Pancreatic Cancer Patient Nutrition Guide (June 2021). PI2429_JFPC_0621_CR0621.",
    author: "Ryan Surace, Senior Dietitian, Epworth Richmond",
    url: "https://www.epworth.org.au/jreissaticentre",
    contact: "03 9426 8880",
    year: 2021,
  },
  // The three references the JPCC guide itself cites.
  hendifar_2019: {
    id: "hendifar_2019",
    short_label: "Hendifar 2019",
    full_citation:
      "Hendifar AE, Petzel MQB, Zimmers TA, Denlinger CS, Matrisian LM, Picozzi VJ, Rahib L (2019). Pancreas Cancer-Associated Weight Loss. The Oncologist 24:691–701.",
    year: 2019,
  },
  mueller_2014: {
    id: "mueller_2014",
    short_label: "Mueller 2014",
    full_citation:
      "Mueller TC, Burmeister MA, Bachmann J, Martignoni M (2014). Cachexia and pancreatic cancer: Are there treatment options? World Journal of Gastroenterology 20(28):9361–9373. doi:10.3748/wjg.v20.i28.9361.",
    year: 2014,
  },
  gartner_2016: {
    id: "gartner_2016",
    short_label: "Gartner 2016",
    full_citation:
      "Gartner S, Kruger J, Aghdassi AA, Steveling A, Simon P, Lerch MM, Mayerle J (2016). Nutrition in Pancreatic Cancer: A Review. Gastrointest Tumours 2(4):195–202. doi:10.1159/000442873.",
    year: 2016,
  },
  // Keto-strategy references currently cited on /nutrition/guide.
  // Kept here so the carb-policy debate has a single source-of-truth
  // registry for both sides.
  wolpin_2009: {
    id: "wolpin_2009",
    short_label: "Wolpin 2009",
    full_citation:
      "Wolpin BM et al. (2009). Hyperglycaemia, insulin resistance, impaired pancreatic β-cell function and risk of pancreatic cancer. JNCI 101(14):1027–1035.",
    year: 2009,
  },
  liao_2019: {
    id: "liao_2019",
    short_label: "Liao 2019",
    full_citation:
      "Liao W-C et al. (2019). Blood glucose concentration and risk of pancreatic cancer: systematic review and dose-response meta-analysis. BMJ 349:g7371.",
    year: 2019,
  },
  cohen_2018: {
    id: "cohen_2018",
    short_label: "Cohen 2018",
    full_citation:
      "Cohen CW et al. (2018). A ketogenic diet is acceptable in women with ovarian and endometrial cancer and has no adverse effects on blood lipids. Nutrition and Cancer 70(7):1187–1199.",
    year: 2018,
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export interface Citation {
  source_id: SourceId;
  page?: number;
  section?: string;
}

export function getSource(id: SourceId): Source {
  return SOURCES[id];
}

// Compact human-readable form for the inline pill. The expanded form
// renders in the <Cite /> component popover with author, URL, contact.
export function formatCitation(c: Citation, locale: Locale): string {
  const s = SOURCES[c.source_id];
  if (!s) return c.source_id;
  if (c.page !== undefined) {
    return locale === "zh"
      ? `${s.short_label} 第 ${c.page} 页`
      : `${s.short_label}, p. ${c.page}`;
  }
  return s.short_label;
}
