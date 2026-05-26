import { generateText } from "ai";
import { subconsciousModel } from "./subconscious";

export type CandidateQuestion = {
  id: string;
  instruction: string;
  promptLabel?: string;
  type: "photo" | "photo_optional" | "yesno";
  estimatedSeconds: number;
};

export type RankedQuestion = CandidateQuestion & {
  detectionROI: number;
  rank: number;
};

export async function generateInspectionScript(
  sku: string,
  productName: string,
  candidatePool: CandidateQuestion[],
): Promise<RankedQuestion[]> {
  const { text } = await generateText({
    model: subconsciousModel,
    prompt: `You are a damage assessment expert for big-and-bulky furniture shipping claims.

Product: ${productName} (SKU: ${sku})
Carrier type: LTL (Less Than Truckload) — elevated concealed damage rate.

Candidate inspection questions (id, label, type, seconds):
${candidatePool.map((q) => `- id=${q.id} label=${q.promptLabel ?? q.id} type=${q.type} seconds=${q.estimatedSeconds}: "${q.instruction}"`).join("\n")}

Based on typical LTL damage patterns for this furniture type, estimate the probability (0.0–1.0) that each question would detect damage IF concealed damage exists.
Respond with ONLY a JSON array, no explanation:
[{"id":"q1","detectionProb":0.82}, ...]`,
  });

  // Pull out the JSON array even if the model wraps it in markdown
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Model did not return valid JSON array");
  const scores: { id: string; detectionProb: number }[] = JSON.parse(match[0]);

  return candidatePool
    .map((q) => {
      const score = scores.find((s) => s.id === q.id);
      const detectionProb = score?.detectionProb ?? 0.5;
      return { ...q, detectionROI: detectionProb / q.estimatedSeconds, rank: 0 };
    })
    .sort((a, b) => b.detectionROI - a.detectionROI)
    .map((q, i) => ({ ...q, rank: i + 1 }));
}

const DAMAGE_SCENARIOS = [
  { name: "back_right_corner_crush", visibleFrom: ["back_right_corner"], baseProb: 0.18 },
  { name: "cushion_seam_tear",        visibleFrom: ["cushion_seam"],       baseProb: 0.14 },
  { name: "drawer_misalignment",      visibleFrom: ["drawer_yesno"],       baseProb: 0.09 },
  { name: "front_left_leg_dent",      visibleFrom: ["front_left_leg"],     baseProb: 0.11 },
  { name: "other_unspecified",        visibleFrom: ["optional_other"],     baseProb: 0.04 },
];

export function fallbackScriptGen(
  candidatePool: CandidateQuestion[],
  trials = 10000,
): RankedQuestion[] {
  const scores = candidatePool.map((q) => ({ q, hits: 0 }));
  for (let t = 0; t < trials; t++) {
    for (const scen of DAMAGE_SCENARIOS) {
      if (Math.random() < scen.baseProb) {
        for (const s of scores) {
          if (scen.visibleFrom.includes(s.q.promptLabel ?? s.q.id)) {
            if (Math.random() < 0.85) s.hits++;
            break;
          }
        }
      }
    }
  }
  return scores
    .map((s) => ({ ...s.q, detectionROI: s.hits / s.q.estimatedSeconds / trials, rank: 0 }))
    .sort((a, b) => b.detectionROI - a.detectionROI)
    .map((q, i) => ({ ...q, rank: i + 1 }));
}
