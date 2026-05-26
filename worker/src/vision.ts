import { VisionResultSchema, type VisionResult } from './types';

export async function callBasetenVision(
  env: { BASETEN_VISION_URL: string; BASETEN_API_KEY: string; MOCK_VISION?: string },
  photoBase64: string,
  promptLabel: string,
  stepIndex: number
): Promise<VisionResult> {
  if (env.MOCK_VISION === '1' || !env.BASETEN_API_KEY) {
    return mockVision(promptLabel, stepIndex);
  }

  const prompt = `You are inspecting a piece of furniture for shipping damage. The user was asked to photograph: "${promptLabel}".

Respond with strict JSON only, matching this schema:
{ "validation": { "matchesPrompt": boolean, "confidence": 0-1 },
  "damage": { "detected": boolean, "severity": "none|minor|moderate|severe", "location": string, "description": string, "boundingBox": [x1,y1,x2,y2] in 0-1 normalized coords or null } }

Be conservative — only flag damage you can clearly see. Do not invent damage.`;

  try {
    const res = await fetch(env.BASETEN_VISION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${env.BASETEN_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ image: photoBase64, prompt, max_tokens: 400, temperature: 0.1 }),
    });
    if (!res.ok) {
      console.error('Baseten vision non-200', res.status, await res.text().catch(() => ''));
      return mockVision(promptLabel, stepIndex);
    }
    const data: any = await res.json();
    const raw = data.output ?? data.generated_text ?? data.text ?? data;
    const parsed = typeof raw === 'string' ? JSON.parse(extractJson(raw)) : raw;
    return VisionResultSchema.parse(parsed);
  } catch (err) {
    console.error('Baseten vision failed, using mock', err);
    return mockVision(promptLabel, stepIndex);
  }
}

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}

// Mock damage shows up on step index 1 (cushion seam) for demo predictability.
function mockVision(promptLabel: string, stepIndex: number): VisionResult {
  if (stepIndex === 1) {
    return {
      validation: { matchesPrompt: true, confidence: 0.94 },
      damage: {
        detected: true,
        severity: 'moderate',
        location: `${promptLabel.replace(/_/g, ' ')}, left side`,
        description: 'Visible tear in seam approximately 4 inches long with stuffing exposed.',
        boundingBox: [0.22, 0.41, 0.58, 0.55],
      },
    };
  }
  return {
    validation: { matchesPrompt: true, confidence: 0.91 },
    damage: { detected: false, severity: 'none', location: '', description: '', boundingBox: null },
  };
}
