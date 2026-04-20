export interface Trial {
  id?: number;
  trial_id: string;
  name: string;
  sponsor?: string;
  phase?: string;
  line?: string;
  drug?: string;
  status: "enrolling" | "closed" | "pending" | "active" | "completed";
  site?: string;
  eligibility_summary?: string;
  disqualifying_events?: string[];
  notes?: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface BridgeStatus {
  function_score: number;
  disease_score: number;
  composite_score: number;
  zone: "green" | "yellow" | "orange" | "red";
  eligible_trials: string[];
  ineligible_trials: string[];
  computed_at: string;
}
