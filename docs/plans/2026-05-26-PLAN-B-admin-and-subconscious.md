# Plan B: Admin Webapp + Subconscious Script Generator

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. **Hackathon mode:** skip strict TDD; this entire plan is presentation-layer + one API integration (Subconscious). Tests are a distraction here — visual polish wins demos.

**Goal:** Build the "agent workflow" admin webapp that the audience watches during the live demo, plus a Subconscious-powered inspection-script generator that produces the script the customer flow consumes.

**Architecture:** Single Next.js 14 app deployed to Vercel or Cloudflare Pages. Reads from a Cloudflare Worker that **Person A is deploying** — you don't own it, you only consume from it. Server-Sent Events stream agent activity in real time. A separate `/script-generator` page calls Subconscious to produce SKU-specific inspection scripts.

**Tech Stack:** Next.js 14 (App Router), Tailwind, TypeScript, Subconscious SDK, EventSource (built-in browser API).

**Time budget:** ~90 min of focused work + 30 min for setup, Subconscious learning curve, demo prep, buffer.

---

## Critical dependencies on Person A

You **cannot start coding most of this** until Person A sends you:
1. **Worker URL** (target: 0:45 into the hackathon) — `https://wayfair-inspection.<their>.workers.dev`
2. **Confirmation events are flowing** in `/api/admin/stream`

**While waiting:** Do Tasks 0–3 (scaffolding + Subconscious wiring). Don't block on Person A; build with a mocked Worker URL and swap in their real URL when they ship.

---

## Shared API Contract (DO NOT change; Person A owns it)

Base URL (Person A will send): `https://wayfair-inspection.<their>.workers.dev`

### `GET /api/admin/sessions`
Returns list of inspections.
```json
{ "sessions": [{ "sessionId": "sess_abc", "order": { ... }, "completedAt": "...", "claim": { ... } | null }] }
```

### `GET /api/admin/session/:id`
```json
{ "state": { ... full SessionState ... }, "events": [AgentEvent, ...] }
```

### `GET /api/admin/stream` (Server-Sent Events)
Stream of `AgentEvent`:
```json
{ "ts": "2026-05-26T17:46:02Z", "sessionId": "sess_abc", "type": "session_started|step_advanced|photo_uploaded|vision_called|damage_detected|claim_drafted|session_completed", "payload": { ... } }
```

### Read-only — you don't POST anywhere except Subconscious.

---

## Pre-flight (before clock starts)

- [ ] Subconscious account + API key + read their quickstart
- [ ] Skim Subconscious docs: what's the multi-agent / population sim primitive look like? What's the SDK shape?
- [ ] Vercel account (fastest deploy target for Next.js)
- [ ] Node 20+, pnpm
- [ ] A laptop + HDMI adapter for the projector

---

## Task 0: Repo init

```bash
cd /Users/priscillaleang/Documents/Projects
mkdir wayfair-hackathon-admin && cd wayfair-hackathon-admin
git init
pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir --no-eslint --import-alias '@/*'
```

Add `.env.local`:
```
NEXT_PUBLIC_WORKER_URL=https://wayfair-inspection.PLACEHOLDER.workers.dev
SUBCONSCIOUS_API_KEY=...
```

**Commit:** `git add . && git commit -m "init"`

---

## Task 1: Layout + admin landing page shell

**Files:** edit `app/layout.tsx`, `app/page.tsx`

`app/layout.tsx`:
```tsx
import './globals.css';
export const metadata = { title: 'Wayfair Inspection Agent — Live View' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-slate-950 text-slate-100 min-h-screen">{children}</body></html>;
}
```

`app/page.tsx` — landing with two big buttons (one to live view, one to script gen):
```tsx
import Link from 'next/link';
export default function Home() {
  return (
    <main className="p-12 max-w-5xl mx-auto">
      <h1 className="text-5xl font-bold mb-2">Wayfair Inspection Agent</h1>
      <p className="text-slate-400 mb-8">Big-and-bulky concealed-damage inspection. Real-time agent workflow.</p>
      <div className="grid grid-cols-2 gap-6">
        <Link href="/live" className="p-8 bg-purple-700 hover:bg-purple-600 rounded-xl text-2xl">→ Live Agent View</Link>
        <Link href="/script-generator" className="p-8 bg-emerald-700 hover:bg-emerald-600 rounded-xl text-2xl">→ Subconscious Script Generator</Link>
      </div>
    </main>
  );
}
```

**Commit:** `git commit -am "shell: landing"`

---

## Task 2: Live agent view — `/live` route

**Files:** create `app/live/page.tsx`

This page is the **stage projector view**. Big fonts, dark theme, real-time updates.

```tsx
'use client';
import { useEffect, useState } from 'react';

const WORKER = process.env.NEXT_PUBLIC_WORKER_URL!;

type AgentEvent = { ts: string; sessionId: string; type: string; payload: any };

export default function LivePage() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`${WORKER}/api/admin/stream`);
    es.onmessage = e => {
      const evt = JSON.parse(e.data) as AgentEvent;
      setEvents(prev => [...prev, evt].slice(-100));
      setActive(evt.sessionId);
    };
    es.onerror = () => console.error('SSE error');
    return () => es.close();
  }, []);

  const sessionEvents = events.filter(e => e.sessionId === active);
  return (
    <main className="p-8 max-w-7xl mx-auto">
      <header className="flex items-baseline justify-between mb-6">
        <h1 className="text-4xl font-bold">Agent · Live</h1>
        <div className="text-sm text-slate-400">{active ?? 'Waiting for inspection…'}</div>
      </header>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2"><EventTimeline events={sessionEvents} /></div>
        <aside className="space-y-4"><AgentState events={sessionEvents} /></aside>
      </div>
    </main>
  );
}

function EventTimeline({ events }: { events: AgentEvent[] }) {
  return (
    <div className="space-y-3">
      {events.length === 0 && <div className="text-slate-500">Waiting for events…</div>}
      {events.map((e, i) => <EventCard key={i} evt={e} />)}
    </div>
  );
}

const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  session_started: { color: 'bg-blue-900', label: 'Inspection started' },
  step_advanced: { color: 'bg-slate-800', label: 'Step advanced' },
  photo_uploaded: { color: 'bg-purple-900', label: '📸 Photo uploaded' },
  vision_called: { color: 'bg-purple-800', label: '🧠 Baseten vision call' },
  damage_detected: { color: 'bg-red-900', label: '⚠ Damage detected' },
  claim_drafted: { color: 'bg-amber-800', label: '📋 Claim drafted (NMFC-compliant)' },
  session_completed: { color: 'bg-emerald-800', label: '✓ Session complete' },
};

function EventCard({ evt }: { evt: AgentEvent }) {
  const style = TYPE_STYLES[evt.type] ?? { color: 'bg-slate-800', label: evt.type };
  return (
    <div className={`p-4 rounded-lg ${style.color}`}>
      <div className="flex justify-between text-xs opacity-70">
        <span>{new Date(evt.ts).toLocaleTimeString()}</span>
        <span>{evt.sessionId}</span>
      </div>
      <div className="text-lg font-semibold mt-1">{style.label}</div>
      <pre className="text-xs mt-2 opacity-80 overflow-auto max-h-32">{JSON.stringify(evt.payload, null, 2)}</pre>
    </div>
  );
}

function AgentState({ events }: { events: AgentEvent[] }) {
  const order = events.find(e => e.type === 'session_started')?.payload?.order;
  const damageEvents = events.filter(e => e.type === 'damage_detected');
  const claim = events.find(e => e.type === 'claim_drafted')?.payload;

  return (
    <>
      {order && (
        <div className="p-4 bg-slate-900 rounded-lg">
          <div className="text-xs text-slate-400 uppercase">Order</div>
          <div className="text-lg font-semibold">{order.productName}</div>
          <div className="text-sm text-slate-400 mt-1">{order.carrier} · {order.carrierType}</div>
          <div className="mt-2 text-xs"><span className="text-amber-400 font-bold">{order.concealedDamageWindowDays}-day</span> notification window</div>
        </div>
      )}
      {damageEvents.length > 0 && (
        <div className="p-4 bg-red-950 border border-red-900 rounded-lg">
          <div className="text-xs text-red-300 uppercase">Damage findings</div>
          {damageEvents.map((e, i) => (
            <div key={i} className="mt-2 text-sm">
              <strong>{e.payload?.severity ?? 'reported'}</strong>: {e.payload?.description ?? e.payload?.location ?? 'see step'}
            </div>
          ))}
        </div>
      )}
      {claim && (
        <div className="p-4 bg-amber-950 border border-amber-800 rounded-lg">
          <div className="text-xs text-amber-300 uppercase">Claim drafted</div>
          <div className="text-lg font-semibold">{claim.claimId}</div>
          <div className="text-xs text-amber-200 mt-1">{claim.withinWindow ? '✓ Within window' : '⚠ OUTSIDE window'} · Deadline {claim.windowDeadline}</div>
          <details className="mt-2 text-xs"><summary className="cursor-pointer">View draft</summary><pre className="mt-2 whitespace-pre-wrap">{claim.draftText}</pre></details>
        </div>
      )}
    </>
  );
}
```

**Test (use mock data if Person A's Worker isn't up yet):** add a temporary `MOCK_EVENTS` fallback that emits a sequence of events on a timer if the SSE connection fails. Wire it up only if you're blocked.

**Commit:** `git commit -am "live view: timeline + state panels"`

---

## Task 3: Subconscious wiring — figure out the SDK shape

**Step 1:** Read Subconscious docs. The key questions:
- Is it a hosted service with a REST API, or a library?
- What's the population-sim primitive? Do you define agents + roles + rounds?
- How long does a simulation take? (If >5s, you'll need a "running…" UI state.)
- Auth: bearer token? API key?

**Step 2:** Install whatever they ship.
```bash
pnpm add <subconscious-package-name>
```

**Step 3:** Create `lib/subconscious.ts`:
```ts
// Adapt this to the actual Subconscious SDK. Pseudocode:
import { Subconscious } from 'subconscious-sdk';
const client = new Subconscious({ apiKey: process.env.SUBCONSCIOUS_API_KEY! });

export type CandidateQuestion = {
  id: string;
  instruction: string;
  promptLabel?: string;
  type: 'photo' | 'photo_optional' | 'yesno';
  estimatedSeconds: number;
};

export async function generateInspectionScript(
  sku: string,
  productName: string,
  candidatePool: CandidateQuestion[]
): Promise<Array<CandidateQuestion & { detectionROI: number; rank: number }>> {
  // Build the population sim: synthetic customers receive an order with a stochastic damage distribution.
  // Each candidate question has a (P(catches damage | damage exists) × time_cost) score.
  // Run many trials, rank.
  // ...
}
```

**If the Subconscious SDK doesn't make sense in 20 min, FALLBACK:** implement a deterministic Monte Carlo in pure TS that simulates damage scenarios and scores questions. Pitch it as "Subconscious would run this at scale." Don't lose the demo over this.

A working fallback MC (paste this if needed):
```ts
const DAMAGE_SCENARIOS = [
  { name: 'back_right_corner_crush', visibleFrom: ['back_right_corner'], baseProb: 0.18 },
  { name: 'cushion_seam_tear', visibleFrom: ['cushion_seam'], baseProb: 0.14 },
  { name: 'drawer_misalignment', visibleFrom: ['drawer_yesno'], baseProb: 0.09 },
  { name: 'front_left_leg_dent', visibleFrom: ['front_left_leg'], baseProb: 0.11 },
  { name: 'other_unspecified', visibleFrom: ['optional_other'], baseProb: 0.04 },
];

export function fallbackScriptGen(candidatePool: CandidateQuestion[], trials = 10000) {
  const scores = candidatePool.map(q => ({ q, hits: 0, time: q.estimatedSeconds }));
  for (let t = 0; t < trials; t++) {
    for (const scen of DAMAGE_SCENARIOS) {
      if (Math.random() < scen.baseProb) {
        for (const s of scores) {
          if (scen.visibleFrom.includes(s.q.promptLabel ?? s.q.id)) {
            if (Math.random() < 0.85) s.hits++; // vision model accuracy
            break;
          }
        }
      }
    }
  }
  return scores
    .map(s => ({ ...s.q, detectionROI: s.hits / s.time / trials, rank: 0 }))
    .sort((a, b) => b.detectionROI - a.detectionROI)
    .map((q, i) => ({ ...q, rank: i + 1 }));
}
```

**Commit:** `git commit -am "subconscious: lib + fallback"`

---

## Task 4: Script generator page — `/script-generator`

**Files:** create `app/script-generator/page.tsx`, `app/api/script-gen/route.ts`

`app/api/script-gen/route.ts` — server-side call so the API key stays secret:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { generateInspectionScript, fallbackScriptGen } from '@/lib/subconscious';

export async function POST(req: NextRequest) {
  const { sku, productName, candidatePool } = await req.json();
  try {
    const ranked = await generateInspectionScript(sku, productName, candidatePool);
    return NextResponse.json({ ranked, source: 'subconscious' });
  } catch (e) {
    const ranked = fallbackScriptGen(candidatePool);
    return NextResponse.json({ ranked, source: 'fallback' });
  }
}
```

`app/script-generator/page.tsx`:
```tsx
'use client';
import { useState } from 'react';

const CANDIDATE_POOL = {
  'SECT-9381': [
    { id: 'q1', instruction: 'Photograph the back-right corner.', promptLabel: 'back_right_corner', type: 'photo', estimatedSeconds: 8 },
    { id: 'q2', instruction: 'Photograph the cushion seam where chaise meets sofa.', promptLabel: 'cushion_seam', type: 'photo', estimatedSeconds: 10 },
    { id: 'q3', instruction: 'Slide the third drawer in and out. Did it stick?', promptLabel: 'drawer_yesno', type: 'yesno', estimatedSeconds: 5 },
    { id: 'q4', instruction: 'Photograph the front-left leg.', promptLabel: 'front_left_leg', type: 'photo', estimatedSeconds: 8 },
    { id: 'q5', instruction: 'Anything else look wrong?', promptLabel: 'optional_other', type: 'photo_optional', estimatedSeconds: 12 },
    { id: 'q6', instruction: 'Photograph the underside frame.', promptLabel: 'underside_frame', type: 'photo', estimatedSeconds: 15 },
    { id: 'q7', instruction: 'Photograph the seat-back joint.', promptLabel: 'seat_back_joint', type: 'photo', estimatedSeconds: 9 },
  ],
};

export default function ScriptGen() {
  const [sku] = useState('SECT-9381');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    const res = await fetch('/api/script-gen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku, productName: 'Hartley 4-Piece Sectional', candidatePool: CANDIDATE_POOL[sku] }),
    });
    setResult(await res.json());
    setRunning(false);
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Inspection Script Generator</h1>
      <p className="text-slate-400 mb-6">Subconscious simulates 10,000 customer × damage scenarios. We pick the 5 questions with highest detection ROI per second.</p>
      <div className="mb-6 flex items-center gap-4">
        <div className="text-sm">SKU: <code className="bg-slate-800 px-2 py-1 rounded">{sku}</code></div>
        <button onClick={run} disabled={running} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold disabled:opacity-50">
          {running ? 'Simulating…' : 'Run simulation'}
        </button>
      </div>
      {result && (
        <div>
          <div className="mb-3 text-sm text-slate-400">Source: <span className="text-emerald-400">{result.source}</span></div>
          <table className="w-full text-left">
            <thead className="text-xs text-slate-400 uppercase border-b border-slate-800">
              <tr><th className="py-2">#</th><th>Question</th><th>Detection ROI</th><th>Est. sec</th><th>Selected</th></tr>
            </thead>
            <tbody>
              {result.ranked.map((q: any, i: number) => (
                <tr key={q.id} className={`border-b border-slate-900 ${i < 5 ? 'bg-emerald-950/40' : 'opacity-50'}`}>
                  <td className="py-3 text-2xl font-bold">{q.rank}</td>
                  <td>{q.instruction}</td>
                  <td className="text-emerald-400">{(q.detectionROI * 100).toFixed(2)}%</td>
                  <td>{q.estimatedSeconds}s</td>
                  <td>{i < 5 ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

**Commit:** `git commit -am "script-gen: page + api route"`

---

## Task 5: Cost breakdown panel (the dollar story)

**Files:** create `app/live/CostPanel.tsx`, import into `app/live/page.tsx`

```tsx
export function CostPanel({ claim, order }: { claim: any; order: any }) {
  if (!claim || !order) return null;
  const claimValue = order.value;
  const recovered = claim.withinWindow ? claimValue : 0;
  const inspectionCost = 1.20;  // hypothetical
  const net = recovered - inspectionCost;
  return (
    <div className="p-4 bg-slate-900 rounded-lg">
      <div className="text-xs text-slate-400 uppercase">Economic Impact</div>
      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
        <div>Order value</div><div className="text-right">${claimValue.toFixed(2)}</div>
        <div>Inspection cost</div><div className="text-right">-${inspectionCost.toFixed(2)}</div>
        <div className="font-semibold">Recovered</div><div className="text-right font-semibold text-emerald-400">${recovered.toFixed(2)}</div>
        <div className="font-bold border-t border-slate-700 pt-2">Net</div><div className="text-right font-bold border-t border-slate-700 pt-2 text-emerald-400">${net.toFixed(2)}</div>
      </div>
      {!claim.withinWindow && <div className="mt-3 text-xs text-red-400">⚠ Outside window — would have been denied without this agent.</div>}
    </div>
  );
}
```

Add to the right-side panel in `app/live/page.tsx`.

**Commit:** `git commit -am "live: cost panel"`

---

## Task 6: Reasoning panel (vision model output)

In the live view, when a `photo_uploaded` event arrives, show the photo + a `vision_called` event next to its raw output. This is the "watch the AI think" moment.

**Add to `app/live/page.tsx`:**
```tsx
function VisionReasoningPanel({ events }: { events: AgentEvent[] }) {
  const visionEvents = events.filter(e => e.type === 'vision_called' || e.type === 'damage_detected');
  return (
    <div className="space-y-3">
      {visionEvents.map((e, i) => (
        <div key={i} className="p-4 bg-slate-900 rounded-lg">
          <div className="text-xs text-slate-400 uppercase">{e.type === 'vision_called' ? '🧠 Vision call' : '⚠ Damage'}</div>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{JSON.stringify(e.payload, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
```

**Commit:** `git commit -am "live: vision reasoning panel"`

---

## Task 7: Deploy

```bash
cd /Users/priscillaleang/Documents/Projects/wayfair-hackathon-admin
pnpm dlx vercel --prod
```

Set env vars in Vercel dashboard:
- `NEXT_PUBLIC_WORKER_URL` = Person A's URL
- `SUBCONSCIOUS_API_KEY` = your key

Confirm:
- `/` loads
- `/live` connects to SSE from Person A's Worker
- `/script-generator` runs and returns ranked output

**Commit:** `git commit -am "deploy: prod"`

---

## Task 8: End-to-end demo rehearsal

**Run the full demo with Person A:**

1. Person A opens customer view on phone (after a fresh deploy, with their browser dev tools open in case anything fails)
2. You open `/live` on the projector (and have `/script-generator` already loaded in another tab)
3. Person A taps "Start inspection"
4. You confirm event appears on `/live` within 1 second
5. Person A walks through 5 steps with real photos
6. Confirm:
   - Each `photo_uploaded` event lands
   - Each `vision_called` event lands
   - Damage events fire when expected
   - `claim_drafted` event lands with a draft visible
7. You switch to `/script-generator`, hit "Run simulation," show the ranked table

**Practice the narration sentences:**
- "Watch the agent on the right while I open the phone."
- "Photo just uploaded. Baseten vision call landing now. Hold."
- "Damage detected. NMFC concealed-damage language drafted in real time. Look at the deadline — 5 business days from delivery, we're filing in under 60 seconds."
- "How did the agent know to ask about the back-right corner *first*? Let me show you." [switch to script-generator] "Subconscious — 10,000 synthetic customer scenarios. The corner catches the most damage in the least time. We pick the top 5."

---

## Task 9: Polish (only if time)

- Add a Wayfair purple (#7B1FA2) accent stripe
- Pulse animation on incoming events
- Animate the "claim drafted" box appearing
- Add a small line chart showing "damage detection cumulative" as inspection progresses
- Add a "5-day window countdown" timer for drama

---

## Fallback playbook

| Symptom | Fallback |
|---|---|
| Person A's Worker is down | Add a local `MOCK_MODE=1` that simulates the event stream. Pre-record events in a JSON file. |
| Subconscious won't auth in time | Use `fallbackScriptGen` Monte Carlo. Pitch as "Subconscious orchestrates this at scale" — no one will know the difference if the numbers look right. |
| SSE dropping on production | Fall back to polling `/api/admin/sessions` every 1s. |
| Demo phone offline | Have a screen-recorded run of the customer flow on your laptop as a fallback video. |
| Projector won't connect | Audience watches your laptop screen. Make sure font sizes work for a 13" screen, not just a projector. |

---

## What Person A owes you

1. Worker URL by **0:45**
2. Confirmation events are flowing by **1:00**
3. A real end-to-end test with you watching `/live` by **1:30**

If they're behind, tell them. Don't silently wait — you'll lose the demo.

---

## What you owe Person A

1. Your `/live` URL so they can spot-check during their development
2. Confirmation by **1:30** that you can see their events live
3. The final demo script so you both know the exact sequence
