// Legacy module types (v17). See docs/LEGACY_MODULE.md §"Data model"
// for the rationale. These tables form the corpus that the biographer
// agent curates — the raw profile_entries, the prompt library that
// drives them, the derived aspects, the biographical outline
// (Butler-style life review), the cross-perspective memory clusters,
// and the singleton consent record that bounds future AI use.

import type { EnteredBy, Locale } from "./clinical";
import type { LocalizedString } from "./feed";

export type ProfileEntryKind =
  | "voice_memo"
  | "video"
  | "photo"
  | "story"
  | "value"
  | "relationship"
  | "opinion"
  | "preference"
  | "mannerism"
  | "quote";

export type ProfileEntryMode =
  | "first_person_subject" // the patient speaking about themselves
  | "first_person_family" // family member's own reflection (their experience)
  | "observational" // family member speaking about the patient
  | "shared"; // recorded together

export type ProfileVisibility =
  | "family" // default — whole household sees
  | "author_and_hulin" // only author + the patient
  | "private"; // author-only, no propagation

export type RelationshipDyad =
  | "hulin-catherine"
  | "hulin-thomas"
  | "hulin-self"
  | "family-whole";

export interface ProfileEntry {
  id?: number;
  kind: ProfileEntryKind;
  prompt_id?: number;
  title?: string;
  transcript?: string;
  summary?: string;
  language: "en" | "zh" | "mixed";
  recorded_at: string;
  duration_ms?: number;
  author: EnteredBy;
  entry_mode: ProfileEntryMode;
  visibility: ProfileVisibility;
  propagate: boolean;
  relationship_dyad?: RelationshipDyad;
  tags: string[];
  memory_cluster_id?: number;
  people_mentioned?: string[];
  household_members_mentioned?: EnteredBy[];
  /** If true, this entry never propagates regardless of visibility. */
  private_to_author?: boolean;
  timeline_entry_id?: number;
  created_at: string;
  updated_at: string;
}

export type PromptDepth =
  | "icebreaker"
  | "biographical"
  | "value"
  | "reflective"
  | "dignity"
  | "lightness";

export type PromptAudience =
  | "hulin"
  | "catherine"
  | "thomas"
  | "any_family"
  | "shared_family";

export type PromptSource =
  | "dignity_therapy"
  | "mcp"
  | "fgft"
  | "narrative_med"
  | "pennebaker"
  | "butler_life_review"
  | "ambiguous_loss"
  | "chinese_tradition"
  | "custom";

export type PromptSensitivity = "low" | "medium" | "high";

export interface ProfilePrompt {
  id?: number;
  /** Broad category slug — drives the outline chapter coverage. */
  category: string;
  depth: PromptDepth;
  audience: PromptAudience;
  question: LocalizedString;
  source: PromptSource;
  sensitivity: PromptSensitivity;
  /** 0..1. Higher = surfaces more often under the cadence engine. */
  cadence_weight: number;
  /** Linked cross-audience prompts on the same theme. */
  pair_id?: string;
  asked_at?: string;
  answered_entry_id?: number;
  created_at: string;
  updated_at: string;
}

export type AspectKind =
  | "value"
  | "catchphrase"
  | "story"
  | "relationship"
  | "opinion"
  | "mannerism";

export interface ProfileAspect {
  id?: number;
  aspect: AspectKind;
  label: string;
  description?: string;
  evidence_ids: number[];
  confidence: number; // 0..1
  chapter?: string;
  coverage_contribution?: number;
  last_updated: string;
}

export type OutlineTargetDepth = "essential" | "rich" | "optional";

export interface BiographicalOutline {
  id?: number;
  chapter: string;
  sub_chapter?: string;
  /** Butler life-review arc position. Lower = earlier in life-stage order. */
  arc_position: number;
  target_depth: OutlineTargetDepth;
  coverage: number; // 0..1 overall
  family_coverage: {
    hulin: number;
    catherine: number;
    thomas: number;
  };
  linked_entries: number[];
  open_prompts: number[];
  updated_at: string;
}

export interface MemoryCluster {
  id?: number;
  title: string;
  approximate_date?: string; // YYYY or YYYY-MM or YYYY-MM-DD
  approximate_date_start?: string;
  approximate_date_end?: string;
  people_mentioned: string[];
  household_members_involved: EnteredBy[];
  propagate: boolean;
  seed_entry_id: number;
  created_by: EnteredBy;
  created_at: string;
  updated_at: string;
}

/**
 * Singleton row (id=1) bounding the future use of the patient's corpus.
 * Each mode is a separate opt-in captured while the patient can
 * authorise it themselves. Refusal is honoured permanently — export
 * bundle omits material for refused modes. See docs/LEGACY_MODULE.md
 * §"Companion consent framework".
 */
export interface ProfileConsent {
  id: 1;
  reminiscence_mode: boolean; // playback of actual recorded voice
  letter_mode: boolean; // generated letters in his voice (flagged)
  advisor_mode: boolean; // "what would Dad have said" with citations
  free_form_chat: boolean; // default OFF; explicit opt-in
  voice_cloning_for_tts: boolean; // default OFF; separate opt-in
  last_updated_by: EnteredBy;
  updated_at: string;
}

export const DEFAULT_PROFILE_CONSENT: Omit<
  ProfileConsent,
  "last_updated_by" | "updated_at"
> = {
  id: 1,
  reminiscence_mode: false,
  letter_mode: false,
  advisor_mode: false,
  free_form_chat: false,
  voice_cloning_for_tts: false,
};
