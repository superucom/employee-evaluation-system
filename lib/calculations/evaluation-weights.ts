/**
 * Evaluation Weight Presets & Rules (Based on 15 Points Maximum)
 * สัดส่วนการประเมินดุลพินิจในแต่ละเดือน (คะแนนเต็ม 15)
 */

export interface WeightRuleItem {
  evaluatorRole: string; // "Super", "S.Sup", "Head", "SH", "HRD", "Head/Transfer"
  scoreWeight: number; // e.g. 10, 5, 2.5, 6.25, 1.25, 7.5
  ratio: number; // e.g. 2, 1, 0.5, 1.25, 0.25, 1.5
  percentage: number; // (scoreWeight / 15) * 100
}

export interface EvaluationWeightPreset {
  key: string;
  targetGroup: string;
  description: string;
  totalScore: number; // 15
  roles: WeightRuleItem[];
}

export const EVALUATION_WEIGHT_PRESETS: EvaluationWeightPreset[] = [
  {
    key: "H_TF_HRD",
    targetGroup: "H / TF / HRD",
    description: "ระดับ Head / Transfer / HRD",
    totalScore: 15,
    roles: [
      { evaluatorRole: "Super", scoreWeight: 10, ratio: 2, percentage: 66.67 },
      { evaluatorRole: "S.Sup", scoreWeight: 5, ratio: 1, percentage: 33.33 },
    ],
  },
  {
    key: "QC",
    targetGroup: "QC",
    description: "ตำแหน่ง QC (Quality Control)",
    totalScore: 15,
    roles: [
      { evaluatorRole: "Super", scoreWeight: 5, ratio: 1, percentage: 33.33 },
      { evaluatorRole: "S.Sup", scoreWeight: 2.5, ratio: 0.5, percentage: 16.67 },
      { evaluatorRole: "HRD", scoreWeight: 7.5, ratio: 1.5, percentage: 50.0 },
    ],
  },
  {
    key: "SH_STF",
    targetGroup: "S.H / S.TF",
    description: "ระดับ Sub Head / Senior Transfer",
    totalScore: 15,
    roles: [
      { evaluatorRole: "Super", scoreWeight: 5, ratio: 1, percentage: 33.33 },
      { evaluatorRole: "S.Sup", scoreWeight: 2.5, ratio: 0.5, percentage: 16.67 },
      { evaluatorRole: "Head/Transfer", scoreWeight: 7.5, ratio: 1.5, percentage: 50.0 },
    ],
  },
  {
    key: "SP",
    targetGroup: "SP",
    description: "ตำแหน่ง Support / Specialist",
    totalScore: 15,
    roles: [
      { evaluatorRole: "Super", scoreWeight: 5, ratio: 1, percentage: 33.33 },
      { evaluatorRole: "S.Sup", scoreWeight: 2.5, ratio: 0.5, percentage: 16.67 },
      { evaluatorRole: "Head", scoreWeight: 7.5, ratio: 1.5, percentage: 50.0 },
    ],
  },
  {
    key: "STAFF",
    targetGroup: "CALL / MC / PT / MKT / WD / CS",
    description: "พนักงานทั่วไป (Call, MC, PT, MKT, WD, CS)",
    totalScore: 15,
    roles: [
      { evaluatorRole: "Super", scoreWeight: 5, ratio: 1, percentage: 33.33 },
      { evaluatorRole: "S.Sup", scoreWeight: 2.5, ratio: 0.5, percentage: 16.67 },
      { evaluatorRole: "Head", scoreWeight: 6.25, ratio: 1.25, percentage: 41.67 },
      { evaluatorRole: "SH", scoreWeight: 1.25, ratio: 0.25, percentage: 8.33 },
    ],
  },
  {
    key: "CR",
    targetGroup: "CR",
    description: "ตำแหน่ง CR",
    totalScore: 15,
    roles: [
      { evaluatorRole: "Super", scoreWeight: 5, ratio: 1, percentage: 33.33 },
      { evaluatorRole: "S.Sup", scoreWeight: 2.5, ratio: 0.5, percentage: 16.67 },
      { evaluatorRole: "Head", scoreWeight: 7.5, ratio: 1.5, percentage: 50.0 },
    ],
  },
];

/**
 * Determine the preset matching an employee's position or department
 */
export function getPresetForPosition(positionOrTitle: string | null | undefined): EvaluationWeightPreset {
  if (!positionOrTitle) return EVALUATION_WEIGHT_PRESETS[4]; // Default: General Staff

  const p = positionOrTitle.toUpperCase().trim();

  if (p.includes("HEAD") || p.includes("TRANSFER") || p.includes("HRD") || p === "H" || p === "TF") {
    if (p.includes("SUB") || p.includes("S.H") || p.includes("S.TF") || p.includes("SUP")) {
      return EVALUATION_WEIGHT_PRESETS[2]; // SH_STF
    }
    return EVALUATION_WEIGHT_PRESETS[0]; // H_TF_HRD
  }

  if (p.includes("QC") || p.includes("QUALITY")) {
    return EVALUATION_WEIGHT_PRESETS[1]; // QC
  }

  if (p.includes("SP") || p.includes("SUPPORT") || p.includes("SPECIALIST")) {
    return EVALUATION_WEIGHT_PRESETS[3]; // SP
  }

  if (p.includes("CR")) {
    return EVALUATION_WEIGHT_PRESETS[5]; // CR
  }

  return EVALUATION_WEIGHT_PRESETS[4]; // STAFF (CALL / MC / PT / MKT / WD / CS)
}
