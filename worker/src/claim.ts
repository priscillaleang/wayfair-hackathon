import type { Order } from './types';

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

export function computeWindow(deliveredAt: string, windowDays: number, filedAt: Date) {
  const delivered = new Date(deliveredAt);
  const deadline = new Date(delivered);
  deadline.setDate(deadline.getDate() + windowDays);
  return { withinWindow: filedAt <= deadline, windowDeadline: deadline.toISOString().split('T')[0] };
}

export async function draftClaim(
  env: { BASETEN_LLM_URL: string; BASETEN_API_KEY: string; MOCK_VISION?: string },
  order: Order,
  findings: DamageFinding[]
): Promise<Claim> {
  const filedAt = new Date();
  const { withinWindow, windowDeadline } = computeWindow(order.deliveredAt, order.concealedDamageWindowDays, filedAt);
  const claimId = `WF-CLM-${Math.floor(Math.random() * 90000) + 10000}`;

  const draftText = await generateClaimText(env, order, findings, filedAt).catch((err) => {
    console.error('LLM claim drafting failed, using fallback', err);
    return fallbackClaimText(order, findings, filedAt, windowDeadline);
  });

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
  env: { BASETEN_LLM_URL: string; BASETEN_API_KEY: string; MOCK_VISION?: string },
  order: Order,
  findings: DamageFinding[],
  filedAt: Date
): Promise<string> {
  if (env.MOCK_VISION === '1' || !env.BASETEN_API_KEY) {
    const { windowDeadline } = computeWindow(order.deliveredAt, order.concealedDamageWindowDays, filedAt);
    return fallbackClaimText(order, findings, filedAt, windowDeadline);
  }

  const windowCitation =
    order.carrierType === 'LTL'
      ? 'NMFC Item 300135-A (5 business days for concealed damage)'
      : order.carrierType === 'WDN_FULL_SERVICE'
        ? 'Wayfair Full-Service 3-day reporting window'
        : `${order.concealedDamageWindowDays}-day carrier reporting window`;

  const prompt = `You are drafting a concealed-damage freight claim notification.

Carrier: ${order.carrier}
Carrier type: ${order.carrierType}
PRO number: ${order.proNumber}
BOL number: ${order.bolNumber}
Delivered: ${order.deliveredAt}
Inspection completed: ${filedAt.toISOString()}
Concealed damage window: ${order.concealedDamageWindowDays} days (${windowCitation})

Damage findings:
${findings.map((d) => `- Step ${d.stepIndex}: ${d.severity} damage at ${d.location}. ${d.description}`).join('\n')}

Draft a concise claim notification (8-12 lines) that:
1. References the PRO and BOL numbers
2. States the damage was concealed and discovered upon inspection within the carrier's notification window (cite "${windowCitation}")
3. Lists each damage finding
4. Cites 49 CFR 370.3 for required claim elements
5. Requests acknowledgment per 49 U.S.C. § 14706 / 49 CFR 370.9

Output only the claim text. No preamble.`;

  const res = await fetch(env.BASETEN_LLM_URL, {
    method: 'POST',
    headers: { Authorization: `Api-Key ${env.BASETEN_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: 500, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data: any = await res.json();
  const text = (data.output ?? data.generated_text ?? data.text ?? '').toString().trim();
  if (!text) throw new Error('empty LLM output');
  return text;
}

function fallbackClaimText(order: Order, findings: DamageFinding[], filedAt: Date, deadline: string): string {
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
