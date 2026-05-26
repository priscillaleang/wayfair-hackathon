import { VisionResultSchema, type VisionResult } from './types';

type VisionEnv = {
  SUBCONSCIOUS_VISION_URL?: string;
  SUBCONSCIOUS_VISION_API_KEY?: string;
  SUBCONSCIOUS_VISION_MODEL?: string;
  MOCK_VISION?: string;
};

export async function callBasetenVision(
  env: VisionEnv,
  photoBase64: string,
  promptLabel: string,
  stepIndex: number
): Promise<VisionResult> {
  const url = env.SUBCONSCIOUS_VISION_URL?.trim();
  const key = env.SUBCONSCIOUS_VISION_API_KEY?.trim();
  const model = env.SUBCONSCIOUS_VISION_MODEL?.trim() || 'subconscious/tim-qwen3.6-27b';
  if (env.MOCK_VISION === '1' || env.MOCK_VISION === 'vision_only' || !url || !key) {
    return mockVision(promptLabel, stepIndex);
  }

  const userPrompt = `You are inspecting a piece of furniture for shipping damage. The customer was asked to photograph: "${promptLabel.replace(/_/g, ' ')}".

Inspect the image carefully. Look for: tears, dents, scratches, broken pieces, exposed stuffing, splintered wood, fabric pulls, missing parts, misalignment, or any visible defect.

Respond with strict JSON only. No prose, no markdown fences, no thinking out loud. Output EXACTLY this schema and nothing else:

{"validation":{"matchesPrompt":true,"confidence":0.0},"damage":{"detected":false,"severity":"none","location":"","description":"","boundingBox":null}}

Rules:
- severity ∈ {"none","minor","moderate","severe"}
- If no damage visible: detected=false, severity="none", location="", description="", boundingBox=null
- If damage visible: detected=true, fill in severity/location/description, boundingBox is [x1,y1,x2,y2] in 0-1 normalized image coords or null
- matchesPrompt=true if the photo shows the requested area, false otherwise
- Be conservative — only flag damage you can clearly see

Return ONLY the JSON object.`;

  try {
    const res = await fetch(chatUrl(url), {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
            ],
          },
        ],
        max_tokens: 3000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Vision non-200', res.status, body.slice(0, 500));
      return mockVision(promptLabel, stepIndex);
    }
    const data: any = await res.json();
    const text = extractText(data);
    if (!text) {
      console.error('Vision empty content', JSON.stringify(data).slice(0, 500));
      return mockVision(promptLabel, stepIndex);
    }
    const json = JSON.parse(extractJson(text));
    return VisionResultSchema.parse(json);
  } catch (err) {
    console.error('Vision failed, using mock', err);
    return mockVision(promptLabel, stepIndex);
  }
}

function chatUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function extractText(data: any): string {
  return (
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.output ??
    data?.generated_text ??
    data?.text ??
    ''
  ).toString();
}

function extractJson(s: string): string {
  // TIM-style models output reasoning before </think> then the answer
  const afterThink = s.split('</think>').pop() ?? s;
  const m = afterThink.match(/\{[\s\S]*\}/);
  if (m) return m[0];
  const m2 = s.match(/\{[\s\S]*\}/);
  return m2 ? m2[0] : s;
}

// Mock damage on step 1 (cushion seam / leg joint) for demo predictability.
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

export { chatUrl };
