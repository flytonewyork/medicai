// Pre-fill data for the onboarding "Clinical team" step. Lets the
// patient pick a known Melbourne medical oncologist (with GI / pancreas
// involvement) and have the hospital, switchboard, and address
// populated from a fixed table of public institutional numbers.
//
// Everything here is editable downstream — the picker only seeds the
// fields. If a user picks "Other", the fields stay blank for them to
// type. Direct office numbers are not seeded because they vary by
// secretary; the user fills them in if they have them on hand.

export interface MelbourneHospital {
  id: string;
  name: { en: string; zh: string };
  phone: string;
  address: string;
  // 24/7 on-call number when the hospital publishes one distinct from
  // the main switchboard (e.g. cancer helpline, ED direct).
  oncall_phone?: string;
}

export interface MelbourneOncologist {
  id: string;
  name: { en: string; zh: string };
  // Primary hospital affiliation used to pre-fill hospital fields. Some
  // clinicians work across multiple sites; this is the dominant one for
  // GI / pancreas care.
  hospital_id: string;
  // Optional secondary affiliation shown in the picker label.
  also_at?: string;
  specialty: { en: string; zh: string };
}

export const MELBOURNE_HOSPITALS: MelbourneHospital[] = [
  {
    id: "peter_mac",
    name: { en: "Peter MacCallum Cancer Centre", zh: "彼得麦卡伦癌症中心" },
    phone: "+61 3 8559 5000",
    address: "305 Grattan St, Melbourne VIC 3000",
  },
  {
    id: "austin_onj",
    name: {
      en: "Austin Health — Olivia Newton-John Cancer Centre",
      zh: "Austin 医院 — ONJ 癌症中心",
    },
    phone: "+61 3 9496 5000",
    address: "145 Studley Rd, Heidelberg VIC 3084",
  },
  {
    id: "rmh",
    name: { en: "Royal Melbourne Hospital", zh: "皇家墨尔本医院" },
    phone: "+61 3 9342 7000",
    address: "300 Grattan St, Parkville VIC 3050",
  },
  {
    id: "western_sunshine",
    name: {
      en: "Western Health — Sunshine Hospital",
      zh: "Western Health — Sunshine 医院",
    },
    phone: "+61 3 8345 1333",
    address: "176 Furlong Rd, St Albans VIC 3021",
  },
  {
    id: "eastern_box_hill",
    name: {
      en: "Eastern Health — Box Hill Hospital",
      zh: "Eastern Health — Box Hill 医院",
    },
    phone: "+61 3 9095 2222",
    address: "8 Arnold St, Box Hill VIC 3128",
  },
  {
    id: "epworth_freemasons",
    name: { en: "Epworth Freemasons", zh: "Epworth Freemasons" },
    phone: "+61 3 9418 8188",
    address: "320 Victoria Pde, East Melbourne VIC 3002",
  },
  {
    id: "epworth_richmond",
    name: { en: "Epworth Richmond", zh: "Epworth Richmond" },
    phone: "+61 3 9426 6666",
    address: "89 Bridge Rd, Richmond VIC 3121",
  },
  {
    id: "northern",
    name: { en: "Northern Hospital Epping", zh: "Northern 医院 Epping" },
    phone: "+61 3 8405 8000",
    address: "185 Cooper St, Epping VIC 3076",
  },
];

export const MELBOURNE_ONCOLOGISTS: MelbourneOncologist[] = [
  {
    id: "ananda_s",
    name: { en: "A/Prof Sumitra Ananda", zh: "Sumitra Ananda 副教授" },
    hospital_id: "peter_mac",
    also_at: "Epworth Freemasons",
    specialty: { en: "GI / pancreas", zh: "消化道 / 胰腺" },
  },
  {
    id: "tebbutt_n",
    name: { en: "Prof Niall Tebbutt", zh: "Niall Tebbutt 教授" },
    hospital_id: "austin_onj",
    specialty: { en: "GI / pancreas", zh: "消化道 / 胰腺" },
  },
  {
    id: "gibbs_p",
    name: { en: "Prof Peter Gibbs", zh: "Peter Gibbs 教授" },
    hospital_id: "western_sunshine",
    also_at: "WEHI",
    specialty: { en: "GI / colorectal / pancreas", zh: "消化道 / 结直肠 / 胰腺" },
  },
  {
    id: "wong_r",
    name: { en: "A/Prof Rachel Wong", zh: "Rachel Wong 副教授" },
    hospital_id: "eastern_box_hill",
    also_at: "Epworth Eastern",
    specialty: { en: "GI / upper GI", zh: "消化道 / 上消化道" },
  },
  {
    id: "lee_b",
    name: { en: "Dr Belinda Lee", zh: "Belinda Lee 医生" },
    hospital_id: "northern",
    also_at: "Royal Melbourne Hospital",
    specialty: { en: "GI / pancreas trials", zh: "消化道 / 胰腺临床试验" },
  },
  {
    id: "wong_hl",
    name: { en: "A/Prof Hui-Li Wong", zh: "Hui-Li Wong 副教授" },
    hospital_id: "peter_mac",
    specialty: { en: "GI / pancreas", zh: "消化道 / 胰腺" },
  },
  {
    id: "michael_m",
    name: { en: "Prof Michael Michael", zh: "Michael Michael 教授" },
    hospital_id: "peter_mac",
    specialty: { en: "GI / NET / pancreas", zh: "消化道 / 神经内分泌 / 胰腺" },
  },
];

export const HOSPITAL_BY_ID: Record<string, MelbourneHospital> = Object.fromEntries(
  MELBOURNE_HOSPITALS.map((h) => [h.id, h]),
);

export const ONCOLOGIST_BY_ID: Record<string, MelbourneOncologist> = Object.fromEntries(
  MELBOURNE_ONCOLOGISTS.map((o) => [o.id, o]),
);
