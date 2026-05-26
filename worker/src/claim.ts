import type { Order } from './types';
import { chatUrl } from './vision';

export type DamageFinding = {
  stepIndex: number;
  description: string;
  severity: string;
  location: string;
};

export type Claim = {
  claimId: string;
  carrier: string;
  draftText: string;
  filedAt: string;
  withinWindow: boolean;
  windowDeadline: string;
};

type ClaimEnv = {
  BASETEN_LLM_ENDPOINT_URL?: string;
  BASETEN_LLM_API_KEY?: string;
  MOCK_VISION?: string;
};

export function computeWindow(deliveredAt: string, windowDays: number, filedAt: Date) {
  const delivered = new Date(deliveredAt);
  const deadline = new Date(delivered);
  deadline.setDate(deadline.getDate() + windowDays);
  return {
    withinWindow: filedAt <= deadline,
    windowDeadline: deadline.toISOString().split('T')[0],
  };
}

export async function draftClaim(
  env: ClaimEnv,
  order: Order,
  findings: DamageFinding[]
): Promise<Claim> {
  const filedAt = new Date();
  const { withinWindow, windowDeadline } = computeWindow(
    order.deliveredAt,
    order.concealedDamageWindowDays,
    filedAt
  );
  const claimId = `WF-CLM-${Math.floor(Math.random() * 90000) + 10000}`;

  const draftText = await generateClaimText(env, order, findings, filedAt, windowDeadline).catch(
    (err) => {
      console.error('LLM claim drafting failed, using fallback', err);
      return fallbackClaimText(order, findings, filedAt, windowDeadline);
    }
  );

  return {
    claimId,
    carrier: order.carrier,
    draftText,
    filedAt: filedAt.toISOString(),
    withinWindow,
    windowDeadline,
  };
}

async function generateClaimText(
  env: ClaimEnv,
  order: Order,
  findings: DamageFinding[],
  filedAt: Date,
  windowDeadline: string
): Promise<string> {
  const url = env.BASETEN_LLM_ENDPOINT_URL?.trim();
  const key = env.BASETEN_LLM_API_KEY?.trim();
  if (env.MOCK_VISION === '1' || !url || !key) {
    return fallbackClaimText(order, findings, filedAt, windowDeadline);
  }
  // MOCK_VISION=vision_only allows real LLM while VLM is mocked

  const windowCitation =
    order.carrierType === 'LTL'
      ? 'NMFC Item 300135-A (5 business days for concealed damage)'
      : order.carrierType === 'WDN_FULL_SERVICE'
        ? 'Wayfair Full-Service 3-day reporting window'
        : `${order.concealedDamageWindowDays}-day carrier reporting window`;

  const userPrompt = `You are drafting a concealed-damage freight claim notification.

Carrier: ${order.carrier}
Carrier type: ${order.carrierType}
PRO number: ${order.proNumber}
BOL number: ${order.bolNumber}
Delivered: ${order.deliveredAt}
Inspection completed: ${filedAt.toISOString()}
Concealed damage window: ${order.concealedDamageWindowDays} days (${windowCitation})
Product value: $${order.value.toFixed(2)}

Damage findings:
${findings.map((d) => `- Step ${d.stepIndex}: ${d.severity} damage at ${d.location}. ${d.description}`).join('\n')}

Draft a concise claim notification (8-12 lines) that:
1. References the PRO and BOL numbers
2. States the damage was concealed and discovered upon inspection within the carrier's notification window (cite "${windowCitation}")
3. Lists each damage finding
4. Cites 49 CFR 370.3 for required claim elements
5. Requests acknowledgment per 49 U.S.C. § 14706 / 49 CFR 370.9

Output ONLY the claim text. No preamble, no markdown.`;

  const res = await fetch(chatUrl(url), {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'baseten',
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 3000,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status} ${body.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const text = (
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.output ??
    data?.generated_text ??
    data?.text ??
    ''
  )
    .toString()
    .trim();
  if (!text) throw new Error('empty LLM output');
  return text;
}

function fallbackClaimText(
  order: Order,
  findings: DamageFinding[],
  filedAt: Date,
  deadline: string
): string {
  const windowCitation =
    order.carrierType === 'LTL'
      ? 'NMFC Item 300135-A (5 business days)'
      : order.carrierType === 'WDN_FULL_SERVICE'
        ? 'Wayfair Full-Service Delivery 3-day concealed-damage window'
        : `${order.concealedDamageWindowDays}-day carrier reporting window`;

  return `CONCEALED DAMAGE CLAIM NOTIFICATION

To: ${order.carrier}
PRO #: ${order.proNumber}
BOL #: ${order.bolNumber}
Shipment delivered: ${order.deliveredAt}
Inspection completed: ${filedAt.toISOString()} (within ${windowCitation}; deadline ${deadline})

Pursuant to 49 CFR 370.3 and 49 U.S.C. § 14706 (Carmack Amendment), this notification is filed for concealed damage discovered upon at-delivery inspection of shipment ${order.proNumber}.

Damage findings:
${findings.map((d) => `  • ${d.severity.toUpperCase()} — ${d.location}: ${d.description}`).join('\n')}

Required claim elements (49 CFR 370.3) — provided:
  • Shipment identification (PRO ${order.proNumber}, BOL ${order.bolNumber})
  • Statement of asserted liability for loss/damage
  • Specified or determinable amount of money (claim amount to follow; product value $${order.value.toFixed(2)})

Acknowledgment requested within 30 days per 49 CFR 370.9. Salvage and photo documentation retained.

— Wayfair At-Delivery Inspection Agent`;
}
