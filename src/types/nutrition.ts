import type { EnteredBy, Locale } from "./clinical";

// Macros stored "per 100 g". This is the canonical reference frame for
// every food row, mirroring how nutrition labels are read in AU / EU.
// US-style "per serving" is a derivation, not a source of truth.
export interface MacrosPer100g {
  calories: number;       // kcal
  protein_g: number;
  fat_g: number;
  carbs_total_g: number;  // total carbohydrates
  fiber_g: number;
  sugar_alcohols_g?: number;
  sugar_g?: number;
}

// Net carbs = total - fiber - sugar alcohols. Stored on the row so
// search / sort / threshold filters don't need to recompute on each
// keystroke. Recomputed via `recalcNetCarbs` whenever any of the inputs
// change (e.g. on import or edit).
export interface FoodItem {
  id?: number;
  name: string;
  name_zh?: string;
  brand?: string;
  category: FoodCategory;
  // Subset of common units the patient or caregiver might enter. Weight
  // is canonical; volumes / count are mapped to grams via `default_serving_g`.
  default_serving_g?: number;
  default_serving_label?: string;  // e.g. "1 medium egg (50 g)"
  // Per 100 g.
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_total_g: number;
  fiber_g: number;
  sugar_alcohols_g?: number;
  sugar_g?: number;
  net_carbs_g: number;             // derived: max(0, total - fiber - SA)
  // PDAC / keto guidance. These flags drive the food picker's "good
  // choice" / "go easy" hint without needing a separate rule engine.
  keto_friendly: boolean;          // net carbs ≤ 5 g per 100 g
  pdac_easy_digest?: boolean;      // soft, low-fiber, low-FODMAP-ish
  pdac_high_fat_pert?: boolean;    // fatty enough to flag a Creon / PERT prompt
  pdac_notes?: string;             // free-text rationale (en)
  pdac_notes_zh?: string;
  tags: string[];                  // e.g. ["high-protein", "fatty-fish", "lactose-free"]
  image_url?: string;              // emoji or asset reference
  emoji?: string;                  // single-glyph fallback for picker tiles
  source: FoodSource;
  created_at: string;
  updated_at: string;
}

export type FoodCategory =
  | "protein"
  | "dairy"
  | "fat_oil"
  | "vegetable"
  | "fruit"
  | "grain_starch"
  | "legume"
  | "nut_seed"
  | "beverage"
  | "supplement"
  | "prepared_meal"
  | "condiment"
  | "sweet"
  | "other";

export type FoodSource = "seed" | "custom" | "ai";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

// One meal log = one MealEntry + N MealItems. We keep them split so
// the user can edit a single item (e.g. "actually it was 200 g not
// 150 g") without re-logging the whole meal, and so the daily-totals
// query can sum across items without parsing JSON.
export interface MealEntry {
  id?: number;
  date: string;                    // YYYY-MM-DD (local day the meal counts toward)
  meal_type: MealType;
  logged_at: string;               // ISO datetime
  notes?: string;
  photo_data_url?: string;         // optional — kept small (resized vision blob)
  source: "manual" | "photo" | "text" | "voice";
  confidence?: "low" | "medium" | "high";
  // Snapshot of computed totals so list views don't have to walk items.
  // Recomputed on each item add / edit / remove.
  total_calories: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
  total_fiber_g: number;
  total_net_carbs_g: number;
  pert_taken?: boolean;            // PERT / Creon taken with this meal?
  pert_units?: number;             // Lipase units actually taken
  entered_by: EnteredBy;
  entered_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MealItem {
  id?: number;
  meal_entry_id: number;
  food_id?: number;                // null when the item is inline / AI-only
  food_name: string;               // cached for display & history
  food_name_zh?: string;
  serving_grams: number;
  // Per-item macros, computed at log time from food + grams. Stored so
  // the daily total stays correct even if the underlying food row is
  // later edited or deleted.
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_total_g: number;
  fiber_g: number;
  net_carbs_g: number;
  notes?: string;
  created_at: string;
}

// AI-parser output shape. The parser may either reference a known food
// (`food_id`) or describe an unknown one (`new_food`); the UI lets the
// user confirm before saving.
export interface ParsedMealItem {
  name: string;
  name_zh?: string;
  serving_grams: number;
  serving_label?: string;          // e.g. "1 cup", "small bowl"
  // Direct macro estimate for this item, for cases where the parser
  // cannot match a database food (custom dish, restaurant meal).
  macros?: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_total_g: number;
    fiber_g: number;
  };
  food_id?: number;                // resolved on the client after fuzzy match
  notes?: string;
}

export interface ParsedMeal {
  meal_type?: MealType;
  description: string;
  items: ParsedMealItem[];
  pert_suggestion?: string;
  confidence: "low" | "medium" | "high";
  notes?: string;
}

// Daily target — used by the dashboard to colour-code the totals.
// Defaults are encoded as a function of the patient's weight (see
// nutrition/targets.ts) so a 70 kg patient's protein target is 84 g
// (1.2 g/kg) by default.
export interface DailyNutritionTarget {
  calories_kcal?: number;
  protein_g: number;
  net_carbs_g_max: number;
  fat_g_min?: number;
  fluids_ml?: number;
}

export type LocalizedString = { en: string; zh?: string };

export interface FoodPickerHint {
  tone: "good" | "ok" | "watch" | "avoid";
  label: LocalizedString;
}

export type { Locale };
