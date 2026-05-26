import { VisionResultSchema, type VisionResult } from './types';

type VisionEnv = {
  BASETEN_VISION_ENDPOINT_URL?: string;
  BASETEN_VISION_API_KEY?: string;
  MOCK_VISION?: string;
};

export async function callBasetenVision(
  env: VisionEnv,
  photoBase64: string,
  promptLabel: string,
  stepIndex: number
): Promise<VisionResult> {
  const url = env.BASETEN_VISION_ENDPOINT_URL?.trim();
  const key = env.BASETEN_VISION_API_KEY?.trim();
  if (env.MOCK_VISION === '1' || env.MOCK_VISION === 'vision_only' || !url || !key) {
    return mockVision(promptLabel, stepIndex);
  }

  const systemPrompt = `You are inspecting a piece of furniture for shipping damage. The user was asked to photograph: "${promptLabel}".

Respond with strict JSON only, matching this schema exactly:
{ "validation": { "matchesPrompt": boolean, "confidence": 0-1 },
  "damage": { "detected": boolean, "severity": "none|minor|moderate|severe", "location": string, "description": string, "boundingBox": [x1,y1,x2,y2] in 0-1 normalized coords or null } }

Be conservative — only flag damage you can clearly see (tears, dents, scratches, broken pieces, exposed stuffing, splintered wood, fabric pulls). Do not invent damage. If the photo doesn't show the requested area, set matchesPrompt=false but still inspect what's visible.

Output ONLY the JSON object. No prose, no markdown fences.`;

  try {
    const res = await fetch(chatUrl(url), {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'baseten',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
            ],
          },
        ],
        max_tokens: 2500,
        temperature: 0.1,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Baseten vision non-200', res.status, body.slice(0, 500));
      return mockVision(promptLabel, stepIndex);
    }
    const data: any = await res.json();
    const text = extractText(data);
    if (!text) {
      console.error('Baseten vision empty content', JSON.stringify(data).slice(0, 500));
      return mockVision(promptLabel, stepIndex);
    }
    const json = JSON.parse(extractJson(text));
    return VisionResultSchema.parse(json);
  } catch (err) {
    console.error('Baseten vision failed, using mock', err);
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

export { chatUrl };
