import { vasp } from "./server";

/** Feedback loop: outcomes + calibration — /feedback (M13). */
export type Outcome = {
  outcome_id: string;
  case_id: string;
  vasp: string;
  predicted_confidence: number;
  outcome: "confirmed" | "refuted" | "inconclusive";
  notes: string;
  recorded_by: string;
  created_at: string;
};

export type CalibrationBucket = { decile: string; calibrated: number; samples: number };
export type CalibrationModel = {
  version: string;
  created_at: string;
  created_by: string;
  n_outcomes: number;
  buckets: CalibrationBucket[];
} | null;

export function recordOutcome(payload: {
  case_id: string;
  vasp: string;
  predicted_confidence: number;
  outcome: string;
  notes?: string;
}) {
  return vasp.post<Outcome>("/feedback/outcomes", payload);
}

export function listOutcomes(outcome?: string) {
  return vasp.get<{ outcomes: Outcome[]; count: number }>(
    `/feedback/outcomes${outcome ? `?outcome=${outcome}` : ""}`
  );
}

export function recalibrate() {
  return vasp.post<{ model: CalibrationModel; note: string }>("/feedback/recalibrate");
}

export function getCalibration() {
  return vasp.get<{ model: CalibrationModel; note?: string }>("/feedback/calibration");
}
