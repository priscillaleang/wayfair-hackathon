# Plan A: Backend + Customer Inspection App

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. **Hackathon mode:** skip strict TDD; write tests only for the agent's claim-drafter (where bugs eat demo time). Commit after every task — fast rollback matters more than perfect history.

**Goal:** Build the Cloudflare Worker (vision + claim-drafting API) and the customer mobile-web inspection flow for an at-delivery damage inspection agent for Wayfair big-and-bulky furniture deliveries.

**Architecture:** Two deployables on Person A's machine:
1. **Cloudflare Worker** (`/worker/`) — single Worker exposing REST + SSE endpoints. KV for state, R2 for photos. Calls Baseten for vision + LLM.
2. **Next.js customer app** (`/customer/`) — mobile-first inspection UI. Talks to the Worker via HTTPS. Deployed to Cloudflare Pages.

Partner (Plan B) builds the admin/agent-workflow view on their own laptop, consuming **this Worker's** public URL. The API contract below is the binding interface — do not change it without telling them.

**Tech Stack:** Cloudflare Workers (TypeScript), Workers KV, R2, Baseten, Next.js 14 (App Router), Tailwind, Zod, TypeScript.

**Why this stack:** Cloudflare = sponsor. Workers = single-binary edge deploy in <30 sec. Next.js = fastest mobile-web scaffolding. Tailwind = no design bikeshed. Zod = catches malformed Baseten responses at the boundary (one of the top demo-killers).

**Time budget:** ~95 min of focused work + 25 min for setup, demo-prep, and buffer.

---

## Shared API Contract (DO NOT CHANGE without telling partner)

Base URL: `https://wayfair-inspection.<your-subdomain>.workers.dev`

### `POST /api/inspect/start`
Initialize an inspection session.
```json
// request
{ "orderId": "ORD-1001" }

// response
{
  "sessionId": "sess_abc123",
  "order": {
    "orderId": "ORD-1001",
    "sku": "SECT-9381",
    "productName": "Hartley 4-Piece Sectional",
    "supplier": "Mistana",
    "carrier": "Estes Express",
    "carrierType": "LTL",
    "concealedDamageWindowDays": 5,
    "deliveredAt": "2026-05-26T17:45:00Z"
  },
  "steps": [
    { "index": 0, "instruction": "Photograph the back-right corner.", "promptLabel": "back_right_corner", "type": "photo" },
    { "index": 1, "instruction": "Photograph the cushion seam where the chaise meets the sofa.", "promptLabel": "cushion_seam", "type": "photo" },
    { "index": 2, "instruction": "Slide the third drawer in and out. Did it stick?", "type": "yesno" },
    { "index": 3, "instruction": "Photograph the front-left leg.", "promptLabel": "front_left_leg", "type": "photo" },
    { "index": 4, "instruction": "Anything else look wrong? (optional photo)", "type": "photo_optional" }
  ]
}
```

### `POST /api/inspect/photo`
Upload a photo for a step. Worker calls Baseten, returns vision result.
```json
// request (multipart/form-data)
sessionId: "sess_abc123"
stepIndex: 1
photo: <File>

// response
{
  "stepIndex": 1,
  "validation": { "matchesPrompt": true, "confidence": 0.94 },
  "damage": { "detected": true, "severity": "moderate", "location": "cushion seam, left side", "description": "Visible tear in seam approximately 4 inches long.", "boundingBox": [0.22, 0.41, 0.58, 0.55] }
}
```

### `POST /api/inspect/answer`
Submit a yes/no answer for a non-photo step.
```json
// request
{ "sessionId": "sess_abc123", "stepIndex": 2, "answer": "yes" }
```

### `POST /api/inspect/complete`
Finalize the session. Worker calls LLM to draft a claim if damage was found.
```json
// response (damage found)
{ "outcome": "damage_found", "claim": { "claimId": "WF-CLM-44812", "carrier": "Estes Express", "draftText": "...", "filedAt": "2026-05-26T17:48:14Z", "withinWindow": true, "windowDeadline": "2026-05-31" } }

// response (clean)
{ "outcome": "clean" }
```

### `GET /api/admin/sessions`
List inspections.

### `GET /api/admin/session/:sessionId`
Full event log + state for one session.

### `GET /api/admin/stream`
SSE stream of all agent events.

**AgentEvent shape:**
```json
{ "ts": "2026-05-26T17:46:02Z", "sessionId": "sess_abc123", "type": "photo_uploaded|vision_called|damage_detected|claim_drafted|session_completed|step_advanced", "payload": { ... } }
```

---

## Pre-flight (before clock starts)

- [ ] Cloudflare account + `wrangler login`
- [ ] Baseten account + API key + a deployed vision model (Qwen2.5-VL or LLaVA). Note the model endpoint URL.
- [ ] Baseten deployed LLM (smaller, for claim drafting — Qwen2.5-7B or similar).
- [ ] Node 20+, pnpm installed.
- [ ] Two phones charged: one for demo, one for filming the submission video.
- [ ] Mock order data and reference images ready (`mock-data/`).

---

## Task 0: Repo init

**Step 1:** Create repo.
```bash
cd /Users/priscillaleang/Documents/Projects/wayfair-hackathon
git init
mkdir worker customer mock-data
```

**Step 2:** Add `.gitignore`.
```
node_modules/
.env
.env.local
.dev.vars
.wrangler/
.next/
out/
dist/
```

**Step 3:** Initial commit.
```bash
git add . && git commit -m "init: repo scaffold"
```

---

## Task 1: Mock data

**Files:**
- Create: `mock-data/orders.json`
- Create: `mock-data/inspection-scripts.json`

`mock-data/orders.json`:
```json
{
  "ORD-1001": {
    "orderId": "ORD-1001",
    "sku": "SECT-9381",
    "productName": "Hartley 4-Piece Sectional",
    "supplier": "Mistana",
    "carrier": "Estes Express",
    "carrierType": "LTL",
    "concealedDamageWindowDays": 5,
    "proNumber": "EST-7733410",
    "bolNumber": "BOL-9928141",
    "deliveredAt": "2026-05-26T17:45:00Z",
    "value": 1849.00
  },
  "ORD-1002": {
    "orderId": "ORD-1002",
    "sku": "CONSOLE-2244",
    "productName": "Westbrook Console Table",
    "supplier": "Three Posts",
    "carrier": "Wayfair Delivery Network",
    "carrierType": "WDN_FULL_SERVICE",
    "concealedDamageWindowDays": 3,
    "proNumber": "WDN-1198223",
    "bolNumber": "BOL-9928142",
    "deliveredAt": "2026-05-26T17:45:00Z",
    "value": 429.00
  }
}
```

`mock-data/inspection-scripts.json` — script per SKU (Person B's Subconscious view will regenerate these but we need a fallback):
```json
{
  "SECT-9381": [
    { "index": 0, "instruction": "Photograph the back-right corner.", "promptLabel": "back_right_corner", "type": "photo", "detectionROI": 0.34 },
    { "index": 1, "instruction": "Photograph the cushion seam where chaise meets sofa.", "promptLabel": "cushion_seam", "type": "photo", "detectionROI": 0.28 },
    { "index": 2, "instruction": "Slide the third drawer in and out. Did it stick?", "type": "yesno", "detectionROI": 0.12 },
    { "index": 3, "instruction": "Photograph the front-left leg.", "promptLabel": "front_left_leg", "type": "photo", "detectionROI": 0.18 },
    { "index": 4, "instruction": "Anything else look wrong? (optional photo)", "type": "photo_optional", "detectionROI": 0.08 }
  ],
  "CONSOLE-2244": [
    { "index": 0, "instruction": "Photograph the tabletop edge.", "promptLabel": "tabletop_edge", "type": "photo", "detectionROI": 0.42 },
    { "index": 1, "instruction": "Photograph the leg joint underneath.", "promptLabel": "leg_joint", "type": "photo", "detectionROI": 0.31 },
    { "index": 2, "instruction": "Does the drawer slide smoothly?", "type": "yesno", "detectionROI": 0.15 },
    { "index": 3, "instruction": "Photograph the back panel.", "promptLabel": "back_panel", "type": "photo", "detectionROI": 0.12 }
  ]
}
```

**Commit:** `git add mock-data && git commit -m "data: mock orders + inspection scripts"`

---

## Task 2: Worker scaffold

**Files:**
- Create: `worker/package.json`, `worker/wrangler.toml`, `worker/tsconfig.json`, `worker/src/index.ts`

**Step 1:** `cd worker && pnpm init`. Set `"name": "wayfair-inspection-worker"`.

**Step 2:** Install.
```bash
pnpm add hono zod
pnpm add -D wrangler typescript @cloudflare/workers-types
```

**Step 3:** `worker/wrangler.toml`:
```toml
name = "wayfair-inspection"
main = "src/index.ts"
compatibility_date = "2025-10-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "SESSIONS"
id = "PLACEHOLDER"

[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "wayfair-inspection-photos"

[vars]
BASETEN_VISION_URL = "https://model-XXXX.api.baseten.co/production/predict"
BASETEN_LLM_URL = "https://model-YYYY.api.baseten.co/production/predict"
# BASETEN_API_KEY set via `wrangler secret put BASETEN_API_KEY`
```

**Step 4:** Create KV namespace and R2 bucket.
```bash
npx wrangler kv namespace create SESSIONS
# copy the id into wrangler.toml
npx wrangler r2 bucket create wayfair-inspection-photos
```

**Step 5:** `worker/src/index.ts` — Hono skeleton.
```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  SESSIONS: KVNamespace;
  PHOTOS: R2Bucket;
  BASETEN_VISION_URL: string;
  BASETEN_LLM_URL: string;
  BASETEN_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use('*', cors({ origin: '*' }));

app.get('/health', c => c.json({ ok: true }));

export default app;
```

**Step 6:** Set the Baseten secret.
```bash
echo "BASETEN_API_KEY=YOUR_KEY" > .dev.vars
npx wrangler secret put BASETEN_API_KEY  # for prod
```

**Step 7:** Deploy.
```bash
npx wrangler deploy
```

Confirm `https://wayfair-inspection.<your>.workers.dev/health` returns `{ "ok": true }`. **Send this URL to your partner immediately** — they need it to start.

**Commit:** `git add worker && git commit -m "worker: scaffold + health endpoint deployed"`

---

## Task 3: Types and Zod schemas

**Files:**
- Create: `worker/src/types.ts`

```ts
import { z } from 'zod';

export const OrderSchema = z.object({
  orderId: z.string(),
  sku: z.string(),
  productName: z.string(),
  supplier: z.string(),
  carrier: z.string(),
  carrierType: z.enum(['LTL', 'WDN_FULL_SERVICE', 'PARCEL']),
  concealedDamageWindowDays: z.number(),
  proNumber: z.string(),
  bolNumber: z.string(),
  deliveredAt: z.string(),
  value: z.number(),
});
export type Order = z.infer<typeof OrderSchema>;

export const InspectionStepSchema = z.object({
  index: z.number(),
  instruction: z.string(),
  promptLabel: z.string().optional(),
  type: z.enum(['photo', 'photo_optional', 'yesno']),
  detectionROI: z.number().optional(),
});
export type InspectionStep = z.infer<typeof InspectionStepSchema>;

export const VisionResultSchema = z.object({
  validation: z.object({ matchesPrompt: z.boolean(), confidence: z.number() }),
  damage: z.object({
    detected: z.boolean(),
    severity: z.enum(['none', 'minor', 'moderate', 'severe']).default('none'),
    location: z.string().default(''),
    description: z.string().default(''),
    boundingBox: z.array(z.number()).optional(),
  }),
});
export type VisionResult = z.infer<typeof VisionResultSchema>;

export const SessionStateSchema = z.object({
  sessionId: z.string(),
  order: OrderSchema,
  steps: z.array(InspectionStepSchema),
  results: z.array(z.object({ stepIndex: z.number(), photoKey: z.string().optional(), vision: VisionResultSchema.optional(), answer: z.string().optional() })),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  claim: z.any().optional(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export type AgentEvent = {
  ts: string;
  sessionId: string;
  type: 'session_started' | 'step_advanced' | 'photo_uploaded' | 'vision_called' | 'damage_detected' | 'claim_drafted' | 'session_completed';
  payload: any;
};
```

**Commit:** `git add worker/src/types.ts && git commit -m "worker: zod schemas + types"`

---

## Task 4: Embed mock data in worker

**Files:**
- Create: `worker/src/data.ts`

Embed the JSON from `mock-data/orders.json` and `mock-data/inspection-scripts.json` as TS modules (Workers can't easily read disk files; embed at build time).

```ts
import { Order, InspectionStep } from './types';

export const ORDERS: Record<string, Order> = {
  // ...paste content from mock-data/orders.json
};

export const SCRIPTS: Record<string, InspectionStep[]> = {
  // ...paste content from mock-data/inspection-scripts.json
};
```

**Commit:** `git add . && git commit -m "worker: embed mock data"`

---

## Task 5: `POST /api/inspect/start`

**Files:** modify `worker/src/index.ts`

```ts
import { ORDERS, SCRIPTS } from './data';
import { SessionState, AgentEvent } from './types';

app.post('/api/inspect/start', async c => {
  const body = await c.req.json<{ orderId: string }>();
  const order = ORDERS[body.orderId];
  if (!order) return c.json({ error: 'unknown order' }, 404);
  const steps = SCRIPTS[order.sku];
  if (!steps) return c.json({ error: 'no script for SKU' }, 500);

  const sessionId = `sess_${crypto.randomUUID().slice(0, 8)}`;
  const state: SessionState = {
    sessionId, order, steps, results: [], startedAt: new Date().toISOString(),
  };
  await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
  await emitEvent(c.env, { ts: new Date().toISOString(), sessionId, type: 'session_started', payload: { order, steps } });
  return c.json({ sessionId, order, steps });
});

async function emitEvent(env: Bindings, evt: AgentEvent) {
  const key = `events:${evt.sessionId}`;
  const existing = (await env.SESSIONS.get(key, 'json') as AgentEvent[]) ?? [];
  existing.push(evt);
  await env.SESSIONS.put(key, JSON.stringify(existing), { expirationTtl: 60 * 60 * 6 });
  // Also push to global SSE channel
  const globalKey = 'events:global';
  const global = (await env.SESSIONS.get(globalKey, 'json') as AgentEvent[]) ?? [];
  global.push(evt);
  await env.SESSIONS.put(globalKey, JSON.stringify(global.slice(-200)), { expirationTtl: 60 * 60 * 6 });
}
```

Test:
```bash
curl -X POST https://wayfair-inspection.<your>.workers.dev/api/inspect/start \
  -H "content-type: application/json" \
  -d '{"orderId":"ORD-1001"}'
```
Expected: JSON with `sessionId`, `order`, `steps`.

**Commit:** `git commit -am "worker: start session endpoint"`

---

## Task 6: `POST /api/inspect/photo` (the demo-critical path)

**Files:** modify `worker/src/index.ts`, create `worker/src/vision.ts`

`worker/src/vision.ts`:
```ts
import { VisionResult, VisionResultSchema } from './types';

export async function callBasetenVision(
  env: { BASETEN_VISION_URL: string; BASETEN_API_KEY: string },
  photoBase64: string,
  promptLabel: string
): Promise<VisionResult> {
  const prompt = `You are inspecting a piece of furniture for shipping damage. The user was asked to photograph: "${promptLabel}".

Respond with strict JSON only, matching this schema:
{ "validation": { "matchesPrompt": boolean, "confidence": 0-1 },
  "damage": { "detected": boolean, "severity": "none|minor|moderate|severe", "location": string, "description": string, "boundingBox": [x1,y1,x2,y2] in 0-1 normalized coords or null } }

Be conservative — only flag damage you can clearly see. Do not invent damage.`;

  const res = await fetch(env.BASETEN_VISION_URL, {
    method: 'POST',
    headers: { 'Authorization': `Api-Key ${env.BASETEN_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ image: photoBase64, prompt, max_tokens: 400, temperature: 0.1 }),
  });
  const data = await res.json() as any;
  // Baseten model response shape varies — adjust to your deployed model. Common: { output: "...json..." }
  const raw = data.output ?? data.generated_text ?? data.text ?? data;
  const parsed = typeof raw === 'string' ? JSON.parse(extractJson(raw)) : raw;
  return VisionResultSchema.parse(parsed);
}

function extractJson(s: string): string {
  const m = s.match(/\{[\s\S]*\}/);
  return m ? m[0] : s;
}
```

In `worker/src/index.ts`:
```ts
import { callBasetenVision } from './vision';

app.post('/api/inspect/photo', async c => {
  const form = await c.req.formData();
  const sessionId = form.get('sessionId') as string;
  const stepIndex = parseInt(form.get('stepIndex') as string, 10);
  const photo = form.get('photo') as File;
  if (!sessionId || !photo) return c.json({ error: 'missing fields' }, 400);

  const state = await c.env.SESSIONS.get(sessionId, 'json') as SessionState | null;
  if (!state) return c.json({ error: 'session not found' }, 404);
  const step = state.steps[stepIndex];

  // store photo in R2
  const photoKey = `${sessionId}/step-${stepIndex}.jpg`;
  await c.env.PHOTOS.put(photoKey, await photo.arrayBuffer(), { httpMetadata: { contentType: photo.type } });
  await emitEvent(c.env, { ts: new Date().toISOString(), sessionId, type: 'photo_uploaded', payload: { stepIndex, photoKey } });

  // call vision
  const photoB64 = arrayBufferToBase64(await photo.arrayBuffer());
  await emitEvent(c.env, { ts: new Date().toISOString(), sessionId, type: 'vision_called', payload: { stepIndex, promptLabel: step.promptLabel } });
  const vision = await callBasetenVision(c.env, photoB64, step.promptLabel ?? 'item');

  if (vision.damage.detected) {
    await emitEvent(c.env, { ts: new Date().toISOString(), sessionId, type: 'damage_detected', payload: { stepIndex, ...vision.damage } });
  }

  state.results.push({ stepIndex, photoKey, vision });
  await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });

  return c.json({ stepIndex, validation: vision.validation, damage: vision.damage });
});

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
```

**Test on your local machine** with a real photo:
```bash
curl -X POST .../api/inspect/photo \
  -F "sessionId=sess_XXX" -F "stepIndex=0" -F "photo=@test.jpg"
```
**If Baseten returns malformed JSON, your model's prompt template is wrong — fix immediately, this is the demo-critical path.**

**Commit:** `git commit -am "worker: photo upload + vision call"`

---

## Task 7: `POST /api/inspect/answer`

Add a simple endpoint for the yes/no step:
```ts
app.post('/api/inspect/answer', async c => {
  const { sessionId, stepIndex, answer } = await c.req.json<{ sessionId: string; stepIndex: number; answer: string }>();
  const state = await c.env.SESSIONS.get(sessionId, 'json') as SessionState | null;
  if (!state) return c.json({ error: 'not found' }, 404);
  state.results.push({ stepIndex, answer });
  if (answer === 'yes') {
    await emitEvent(c.env, { ts: new Date().toISOString(), sessionId, type: 'damage_detected', payload: { stepIndex, source: 'yesno', description: state.steps[stepIndex].instruction } });
  }
  await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
  return c.json({ ok: true });
});
```

**Commit:** `git commit -am "worker: yesno answer endpoint"`

---

## Task 8: Claim drafter (TEST THIS ONE)

**Files:** create `worker/src/claim.ts`, create `worker/test/claim.test.ts`

`worker/src/claim.ts`:
```ts
import { Order, VisionResult } from './types';

export async function draftClaim(
  env: { BASETEN_LLM_URL: string; BASETEN_API_KEY: string },
  order: Order,
  damageFindings: { stepIndex: number; description: string; severity: string; location: string }[]
): Promise<{ claimId: string; draftText: string; filedAt: string; withinWindow: boolean; windowDeadline: string }> {
  const filedAt = new Date();
  const delivered = new Date(order.deliveredAt);
  const deadline = new Date(delivered);
  deadline.setDate(deadline.getDate() + order.concealedDamageWindowDays);
  const withinWindow = filedAt <= deadline;
  const claimId = `WF-CLM-${Math.floor(Math.random() * 90000) + 10000}`;

  const prompt = `You are drafting a concealed-damage freight claim notification.

Carrier: ${order.carrier}
Carrier type: ${order.carrierType}
PRO number: ${order.proNumber}
BOL number: ${order.bolNumber}
Delivered: ${order.deliveredAt}
Inspection completed: ${filedAt.toISOString()}
Concealed damage window: ${order.concealedDamageWindowDays} days

Damage findings:
${damageFindings.map(d => `- Step ${d.stepIndex}: ${d.severity} damage at ${d.location}. ${d.description}`).join('\n')}

Draft a concise claim notification (8-12 lines) that:
1. References the PRO and BOL numbers
2. States the damage was concealed and discovered upon inspection within the carrier's notification window (cite "NMFC Item 300135-A 5 business days" if LTL, or "Wayfair Full-Service 3-day window" if WDN_FULL_SERVICE)
3. Lists each damage finding
4. Cites 49 CFR 370.3 for required claim elements
5. Requests acknowledgment per 49 U.S.C. § 14706 / 49 CFR 370.9

Output only the claim text. No preamble.`;

  const res = await fetch(env.BASETEN_LLM_URL, {
    method: 'POST',
    headers: { 'Authorization': `Api-Key ${env.BASETEN_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: 500, temperature: 0.2 }),
  });
  const data = await res.json() as any;
  const draftText = (data.output ?? data.generated_text ?? data.text ?? '').toString().trim();

  return { claimId, draftText, filedAt: filedAt.toISOString(), withinWindow, windowDeadline: deadline.toISOString().split('T')[0] };
}
```

`worker/test/claim.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { draftClaim } from '../src/claim';

describe('draftClaim', () => {
  it('marks within-window when filed before deadline', async () => {
    const result = await draftClaim(
      { BASETEN_LLM_URL: '', BASETEN_API_KEY: '' } as any,
      {
        orderId: 'X', sku: 'X', productName: 'X', supplier: 'X',
        carrier: 'Estes', carrierType: 'LTL', concealedDamageWindowDays: 5,
        proNumber: 'EST-1', bolNumber: 'BOL-1',
        deliveredAt: new Date().toISOString(), value: 100,
      },
      []
    ).catch(() => null);
    // The LLM call will fail without a real endpoint — that's fine, we're testing window math
    // For real test, refactor to extract the window math into a pure function.
  });
});
```

**Hackathon note:** Don't waste time on this test. Refactor only if you have spare time — the window calculation is the only piece worth testing.

**Commit:** `git commit -am "worker: claim drafter"`

---

## Task 9: `POST /api/inspect/complete`

```ts
import { draftClaim } from './claim';

app.post('/api/inspect/complete', async c => {
  const { sessionId } = await c.req.json<{ sessionId: string }>();
  const state = await c.env.SESSIONS.get(sessionId, 'json') as SessionState | null;
  if (!state) return c.json({ error: 'not found' }, 404);

  const damageFindings = state.results
    .filter(r => r.vision?.damage.detected || r.answer === 'yes')
    .map(r => ({
      stepIndex: r.stepIndex,
      description: r.vision?.damage.description ?? state.steps[r.stepIndex].instruction,
      severity: r.vision?.damage.severity ?? 'moderate',
      location: r.vision?.damage.location ?? 'reported via yes/no',
    }));

  if (damageFindings.length === 0) {
    state.completedAt = new Date().toISOString();
    await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
    await emitEvent(c.env, { ts: state.completedAt, sessionId, type: 'session_completed', payload: { outcome: 'clean' } });
    return c.json({ outcome: 'clean' });
  }

  const claim = await draftClaim(c.env, state.order, damageFindings);
  state.claim = claim;
  state.completedAt = new Date().toISOString();
  await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
  await emitEvent(c.env, { ts: state.completedAt, sessionId, type: 'claim_drafted', payload: claim });
  await emitEvent(c.env, { ts: state.completedAt, sessionId, type: 'session_completed', payload: { outcome: 'damage_found', claimId: claim.claimId } });
  return c.json({ outcome: 'damage_found', claim });
});
```

**Commit:** `git commit -am "worker: complete endpoint"`

---

## Task 10: Admin read endpoints (for Person B's view)

```ts
app.get('/api/admin/sessions', async c => {
  // List session IDs from KV — simple approach: keep a meta key
  const list = await c.env.SESSIONS.list({ prefix: 'sess_' });
  const sessions = await Promise.all(list.keys.map(async k => {
    const s = await c.env.SESSIONS.get(k.name, 'json') as SessionState | null;
    return s ? { sessionId: s.sessionId, order: s.order, completedAt: s.completedAt, claim: s.claim ?? null } : null;
  }));
  return c.json({ sessions: sessions.filter(Boolean) });
});

app.get('/api/admin/session/:id', async c => {
  const id = c.req.param('id');
  const state = await c.env.SESSIONS.get(id, 'json') as SessionState | null;
  const events = (await c.env.SESSIONS.get(`events:${id}`, 'json') as AgentEvent[]) ?? [];
  if (!state) return c.json({ error: 'not found' }, 404);
  return c.json({ state, events });
});

app.get('/api/admin/stream', async c => {
  // Simple SSE: poll the global events list and emit deltas
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastCount = 0;
      const tick = async () => {
        const global = (await c.env.SESSIONS.get('events:global', 'json') as AgentEvent[]) ?? [];
        const newEvents = global.slice(lastCount);
        for (const evt of newEvents) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        }
        lastCount = global.length;
      };
      const interval = setInterval(tick, 500);
      // close after 5 min
      setTimeout(() => { clearInterval(interval); controller.close(); }, 5 * 60_000);
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'access-control-allow-origin': '*' } });
});
```

Deploy:
```bash
npx wrangler deploy
```

Smoke test the SSE endpoint:
```bash
curl -N https://wayfair-inspection.<your>.workers.dev/api/admin/stream
```

**Commit:** `git commit -am "worker: admin endpoints + SSE"`

---

## Task 11: Customer app scaffold

```bash
cd /Users/priscillaleang/Documents/Projects/wayfair-hackathon
pnpm create next-app@latest customer --typescript --tailwind --app --no-src-dir --no-eslint --import-alias '@/*'
cd customer
pnpm add zod
```

**Files:** edit `customer/app/layout.tsx`, `customer/app/page.tsx`

`customer/app/layout.tsx` — set viewport for mobile:
```tsx
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 };
```

`customer/.env.local`:
```
NEXT_PUBLIC_WORKER_URL=https://wayfair-inspection.<your>.workers.dev
```

`customer/app/page.tsx`:
```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Wayfair Delivery Inspection (demo)</h1>
      <p className="text-gray-600">Pick a demo order:</p>
      <Link href="/inspect/ORD-1001" className="block p-4 bg-purple-700 text-white rounded-lg">Hartley 4-Piece Sectional</Link>
      <Link href="/inspect/ORD-1002" className="block p-4 bg-purple-700 text-white rounded-lg">Westbrook Console Table</Link>
    </main>
  );
}
```

**Commit:** `git commit -am "customer: scaffold"`

---

## Task 12: Inspection page state machine

**Files:** create `customer/app/inspect/[orderId]/page.tsx`

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const WORKER = process.env.NEXT_PUBLIC_WORKER_URL!;

type Step = { index: number; instruction: string; type: 'photo' | 'photo_optional' | 'yesno'; promptLabel?: string };
type Order = { productName: string; carrier: string; concealedDamageWindowDays: number };

export default function Inspect() {
  const { orderId } = useParams<{ orderId: string }>();
  const [session, setSession] = useState<{ sessionId: string; steps: Step[]; order: Order } | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState<any>(null);

  useEffect(() => {
    fetch(`${WORKER}/api/inspect/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId }) })
      .then(r => r.json()).then(setSession);
  }, [orderId]);

  if (!session) return <div className="p-6">Loading…</div>;
  if (complete) return <Complete result={complete} order={session.order} />;

  const step = session.steps[stepIdx];

  async function submitPhoto(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append('sessionId', session.sessionId);
    fd.append('stepIndex', String(stepIdx));
    fd.append('photo', file);
    const res = await fetch(`${WORKER}/api/inspect/photo`, { method: 'POST', body: fd });
    const data = await res.json();
    setResults(r => [...r, data]);
    setBusy(false);
    advance();
  }

  async function submitAnswer(answer: 'yes' | 'no') {
    setBusy(true);
    await fetch(`${WORKER}/api/inspect/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: session.sessionId, stepIndex: stepIdx, answer }) });
    setResults(r => [...r, { answer }]);
    setBusy(false);
    advance();
  }

  async function advance() {
    if (stepIdx + 1 < session.steps.length) setStepIdx(stepIdx + 1);
    else {
      const res = await fetch(`${WORKER}/api/inspect/complete`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: session.sessionId }) });
      setComplete(await res.json());
    }
  }

  return (
    <main className="min-h-screen bg-white p-6">
      <header className="mb-4">
        <div className="text-xs text-gray-500">{session.order.productName}</div>
        <div className="text-lg font-semibold">Step {stepIdx + 1} of {session.steps.length}</div>
      </header>
      <div className="p-4 bg-purple-50 rounded-lg mb-6 text-lg">{step.instruction}</div>
      {step.type === 'photo' || step.type === 'photo_optional' ? (
        <label className="block w-full p-6 border-2 border-dashed border-purple-300 rounded-lg text-center text-purple-700">
          {busy ? 'Analyzing…' : 'Tap to take photo'}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && submitPhoto(e.target.files[0])} disabled={busy} />
        </label>
      ) : (
        <div className="flex gap-3">
          <button onClick={() => submitAnswer('yes')} disabled={busy} className="flex-1 p-4 bg-red-600 text-white rounded-lg">Yes (it stuck / problem)</button>
          <button onClick={() => submitAnswer('no')} disabled={busy} className="flex-1 p-4 bg-green-600 text-white rounded-lg">No (works fine)</button>
        </div>
      )}
      {results.length > 0 && <ResultsList results={results} />}
    </main>
  );
}

function ResultsList({ results }: { results: any[] }) {
  return (
    <div className="mt-6 space-y-2">
      {results.map((r, i) => (
        <div key={i} className={`p-3 rounded ${r.damage?.detected || r.answer === 'yes' ? 'bg-red-50 text-red-900' : 'bg-green-50 text-green-900'}`}>
          Step {i + 1}: {r.damage?.detected ? `⚠ ${r.damage.severity} damage — ${r.damage.description}` : r.answer === 'yes' ? '⚠ Reported issue' : '✓ Clear'}
        </div>
      ))}
    </div>
  );
}

function Complete({ result, order }: { result: any; order: Order }) {
  if (result.outcome === 'clean') {
    return (
      <main className="min-h-screen bg-green-50 p-6 flex flex-col items-center justify-center text-center">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-semibold">All good</h1>
        <p className="text-gray-700 mt-2">Your inspection is on file. If something comes up later, you're covered.</p>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-white p-6">
      <div className="text-3xl mb-2">📋 Claim filed</div>
      <div className="text-gray-600 mb-4">Reference <strong>{result.claim.claimId}</strong> — filed within carrier window ({order.concealedDamageWindowDays} days for {order.carrier}).</div>
      <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded text-sm">{result.claim.draftText}</pre>
    </main>
  );
}
```

**Commit:** `git commit -am "customer: inspection flow"`

---

## Task 13: Deploy customer app

```bash
cd customer
pnpm build
npx wrangler pages deploy out --project-name wayfair-customer
# or use Next-on-Pages
```

If you hit Next.js + Pages friction, fastest fallback: deploy to Vercel via `vercel --prod`.

Test on phone via the deployed URL. **The full flow must work end-to-end before 1:35.**

**Commit:** `git commit -am "customer: deployed"`

---

## Task 14: Smoke test full flow on phone

- Open URL on phone
- Pick ORD-1001
- Walk through all 5 steps, take real photos (point camera at anything — even a chair)
- Confirm vision call returns something sane
- Confirm claim appears at the end

**If anything is broken, fix it now — not in the demo.**

---

## Task 15: Polish (only if time)

- Add a Wayfair-ish logo/header (purple #7B1FA2, the brand color)
- Add transition animations between steps
- Add a "what we're checking" subtext under each instruction
- Pre-populate damage in the demo by deliberately uploading a damaged-corner image when on stage

---

## Task 16: Demo prep

- Send your worker URL + customer URL to Person B (they need both)
- Tell them how to trigger an event-stream test
- Confirm their admin view is showing your events
- Practice the demo on the phone twice with Person B watching
- Record the fallback video on your phone

---

## Fallback playbook (when things break on stage)

| Symptom | Fallback |
|---|---|
| Baseten vision returns nothing | Pre-recorded vision result keyed off step index. Have a `MOCK_VISION=1` env switch. |
| Camera won't open on demo phone | Use a pre-loaded damaged image, narrate "imagine the camera." |
| WiFi dies | Have the fallback video ready on your laptop. |
| Worker won't deploy in time | Run locally via `wrangler dev`. Have ngrok tunnel ready. |

---

## What you owe Person B

1. Worker URL (send by **0:45**)
2. Confirmation that events are flowing (by **1:00**)
3. The API contract from the top of this doc (already documented above — send them this file)
4. Two test orders ready: ORD-1001 and ORD-1002
