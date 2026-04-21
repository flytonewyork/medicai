import { db, now } from "~/lib/db/dexie";
import { DRUGS_BY_ID } from "~/config/drug-registry";
import { PROTOCOL_BY_ID } from "~/config/protocols";
import type {
  Medication,
  MedicationCategory,
  MedicationSource,
  DoseSchedule,
} from "~/types/medication";
import type { TreatmentCycle } from "~/types/treatment";

// Map supportive lever ID to a drug_id in DRUG_REGISTRY.
// Protocol's typical_supportive uses IDs like "supportive.pert" — we map each
// to the corresponding registered drug (or skip if unmapped).
const SUPPORTIVE_TO_DRUG: Record<string, string> = {
  "supportive.gcsf_prophylaxis": "pegfilgrastim",
  "supportive.olanzapine": "olanzapine",
  "supportive.duloxetine": "duloxetine",
  "supportive.pert": "pancrelipase",
  "supportive.vte_prophylaxis": "apixaban",
};

/**
 * Derive the full list of medications for a given cycle from its protocol.
 * Idempotent: re-running will not create duplicates.
 */
export async function ensureCycleMedications(
  cycle: TreatmentCycle,
): Promise<void> {
  if (!cycle.id) return;
  const protocol = cycle.protocol_id === "custom" && cycle.custom_protocol
    ? cycle.custom_protocol
    : PROTOCOL_BY_ID[cycle.protocol_id];
  if (!protocol) return;

  const existing = await db.medications
    .where("cycle_id")
    .equals(cycle.id)
    .toArray();
  const existingKey = (m: Medication) => `${m.drug_id}:${m.source}`;
  const existingSet = new Set(existing.map(existingKey));

  const toInsert: Medication[] = [];

  // Protocol agents (chemo)
  for (const agent of protocol.agents) {
    const key = `${agent.id}:protocol_agent`;
    if (existingSet.has(key)) continue;
    const drug = DRUGS_BY_ID[agent.id];
    toInsert.push({
      drug_id: agent.id,
      display_name: drug?.name.en ?? agent.name,
      category: (drug?.category ?? "chemo") as MedicationCategory,
      dose: agent.typical_dose,
      route: agent.route,
      schedule: {
        kind: "cycle_linked",
        cycle_days: agent.dose_days,
      } as DoseSchedule,
      source: "protocol_agent" as MedicationSource,
      cycle_id: cycle.id,
      active: true,
      started_on: cycle.start_date,
      created_at: now(),
      updated_at: now(),
    });
  }

  // Supportive meds mapped from protocol.typical_supportive
  for (const supportiveId of protocol.typical_supportive) {
    const drugId = SUPPORTIVE_TO_DRUG[supportiveId];
    if (!drugId) continue;
    const key = `${drugId}:protocol_supportive`;
    if (existingSet.has(key)) continue;
    const drug = DRUGS_BY_ID[drugId];
    if (!drug) continue;
    toInsert.push({
      drug_id: drugId,
      display_name: drug.name.en,
      category: drug.category,
      dose: drug.typical_doses[0]
        ? drug.typical_doses[0].en
        : "See protocol",
      route: drug.default_route,
      schedule: drug.default_schedules[0] ?? { kind: "prn" },
      source: "protocol_supportive" as MedicationSource,
      cycle_id: cycle.id,
      active: true,
      started_on: cycle.start_date,
      created_at: now(),
      updated_at: now(),
    });
  }

  if (toInsert.length > 0) {
    await db.medications.bulkAdd(toInsert);
  }
}

/**
 * Fetch active medications for the current treatment context.
 * - If a cycle is provided, returns meds for that cycle plus user-added (cycle_id null).
 * - If no cycle, returns only user-added active meds.
 */
export async function getActiveMedications(
  cycleId?: number,
): Promise<Medication[]> {
  const all = await db.medications.toArray();
  return all.filter(
    (m) => m.active && (m.cycle_id === cycleId || m.cycle_id == null),
  );
}

/**
 * When a cycle is stopped/cancelled, deactivate its protocol-derived meds.
 * User-added meds (source: "user_added") are left alone — they may continue
 * between cycles.
 */
export async function deactivateCycleMedications(
  cycleId: number,
): Promise<void> {
  const meds = await db.medications
    .where("cycle_id")
    .equals(cycleId)
    .toArray();
  for (const m of meds) {
    if (m.source !== "user_added" && m.id) {
      await db.medications.update(m.id, {
        active: false,
        stopped_on: now(),
        updated_at: now(),
      });
    }
  }
}
