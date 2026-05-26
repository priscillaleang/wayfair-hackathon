import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ORDERS, SCRIPTS } from './data';
import { callBasetenVision } from './vision';
import { draftClaim, type DamageFinding } from './claim';
import type { AgentEvent, Bindings, SessionState } from './types';

const app = new Hono<{ Bindings: Bindings }>();
app.use('*', cors({ origin: '*' }));

app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.post('/api/inspect/start', async (c) => {
  const body = await c.req.json<{ orderId: string }>();
  const order = ORDERS[body.orderId];
  if (!order) return c.json({ error: 'unknown order' }, 404);
  const steps = SCRIPTS[order.sku];
  if (!steps) return c.json({ error: 'no script for SKU' }, 500);

  const sessionId = `sess_${crypto.randomUUID().slice(0, 8)}`;
  const state: SessionState = {
    sessionId,
    order,
    steps,
    results: [],
    startedAt: new Date().toISOString(),
  };
  await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
  await emitEvent(c.env, {
    ts: new Date().toISOString(),
    sessionId,
    type: 'session_started',
    payload: { order, steps },
  });
  return c.json({ sessionId, order, steps });
});

app.post('/api/inspect/photo', async (c) => {
  const form = await c.req.formData();
  const sessionId = form.get('sessionId') as string;
  const stepIndex = parseInt(form.get('stepIndex') as string, 10);
  const photo = form.get('photo') as File | null;
  if (!sessionId || !photo) return c.json({ error: 'missing fields' }, 400);

  const state = (await c.env.SESSIONS.get(sessionId, 'json')) as SessionState | null;
  if (!state) return c.json({ error: 'session not found' }, 404);
  const step = state.steps[stepIndex];
  if (!step) return c.json({ error: 'invalid step' }, 400);

  const buffer = await photo.arrayBuffer();
  const photoKey = `${sessionId}/step-${stepIndex}.jpg`;
  await c.env.PHOTOS.put(photoKey, buffer, { httpMetadata: { contentType: photo.type || 'image/jpeg' } });
  await emitEvent(c.env, {
    ts: new Date().toISOString(),
    sessionId,
    type: 'photo_uploaded',
    payload: { stepIndex, photoKey, promptLabel: step.promptLabel },
  });

  const photoB64 = arrayBufferToBase64(buffer);
  await emitEvent(c.env, {
    ts: new Date().toISOString(),
    sessionId,
    type: 'vision_called',
    payload: { stepIndex, promptLabel: step.promptLabel },
  });
  const vision = await callBasetenVision(c.env, photoB64, step.promptLabel ?? 'item', stepIndex);

  if (vision.damage.detected) {
    await emitEvent(c.env, {
      ts: new Date().toISOString(),
      sessionId,
      type: 'damage_detected',
      payload: { stepIndex, ...vision.damage },
    });
  }

  state.results.push({ stepIndex, photoKey, vision });
  await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
  await emitEvent(c.env, {
    ts: new Date().toISOString(),
    sessionId,
    type: 'step_advanced',
    payload: { stepIndex },
  });

  return c.json({ stepIndex, validation: vision.validation, damage: vision.damage });
});

app.post('/api/inspect/answer', async (c) => {
  const { sessionId, stepIndex, answer } = await c.req.json<{
    sessionId: string;
    stepIndex: number;
    answer: string;
  }>();
  const state = (await c.env.SESSIONS.get(sessionId, 'json')) as SessionState | null;
  if (!state) return c.json({ error: 'not found' }, 404);
  state.results.push({ stepIndex, answer });
  if (answer === 'yes') {
    await emitEvent(c.env, {
      ts: new Date().toISOString(),
      sessionId,
      type: 'damage_detected',
      payload: {
        stepIndex,
        source: 'yesno',
        description: state.steps[stepIndex]?.instruction ?? 'reported issue',
      },
    });
  }
  await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
  await emitEvent(c.env, {
    ts: new Date().toISOString(),
    sessionId,
    type: 'step_advanced',
    payload: { stepIndex },
  });
  return c.json({ ok: true });
});

app.post('/api/inspect/complete', async (c) => {
  const { sessionId } = await c.req.json<{ sessionId: string }>();
  const state = (await c.env.SESSIONS.get(sessionId, 'json')) as SessionState | null;
  if (!state) return c.json({ error: 'not found' }, 404);

  const findings: DamageFinding[] = state.results
    .filter((r) => r.vision?.damage.detected || r.answer === 'yes')
    .map((r) => ({
      stepIndex: r.stepIndex,
      description: r.vision?.damage.description ?? state.steps[r.stepIndex]?.instruction ?? 'reported issue',
      severity: r.vision?.damage.severity ?? 'moderate',
      location: r.vision?.damage.location ?? 'reported via yes/no',
    }));

  if (findings.length === 0) {
    state.completedAt = new Date().toISOString();
    await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
    await emitEvent(c.env, {
      ts: state.completedAt,
      sessionId,
      type: 'session_completed',
      payload: { outcome: 'clean' },
    });
    return c.json({ outcome: 'clean' });
  }

  const claim = await draftClaim(c.env, state.order, findings);
  state.claim = claim;
  state.completedAt = new Date().toISOString();
  await c.env.SESSIONS.put(sessionId, JSON.stringify(state), { expirationTtl: 60 * 60 * 6 });
  await emitEvent(c.env, {
    ts: state.completedAt,
    sessionId,
    type: 'claim_drafted',
    payload: claim,
  });
  await emitEvent(c.env, {
    ts: state.completedAt,
    sessionId,
    type: 'session_completed',
    payload: { outcome: 'damage_found', claimId: claim.claimId },
  });
  return c.json({ outcome: 'damage_found', claim });
});

app.get('/api/admin/sessions', async (c) => {
  const list = await c.env.SESSIONS.list({ prefix: 'sess_' });
  const sessions = await Promise.all(
    list.keys.map(async (k) => {
      const s = (await c.env.SESSIONS.get(k.name, 'json')) as SessionState | null;
      if (!s) return null;
      return {
        sessionId: s.sessionId,
        order: s.order,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        claim: s.claim ?? null,
        resultsCount: s.results.length,
      };
    })
  );
  return c.json({ sessions: sessions.filter(Boolean) });
});

app.get('/api/admin/session/:id', async (c) => {
  const id = c.req.param('id');
  const state = (await c.env.SESSIONS.get(id, 'json')) as SessionState | null;
  const events = ((await c.env.SESSIONS.get(`events:${id}`, 'json')) as AgentEvent[]) ?? [];
  if (!state) return c.json({ error: 'not found' }, 404);
  return c.json({ state, events });
});

app.get('/api/admin/stream', async (c) => {
  const env = c.env;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastCount = 0;
      controller.enqueue(encoder.encode(`: connected\n\n`));
      const tick = async () => {
        try {
          const global =
            ((await env.SESSIONS.get('events:global', 'json')) as AgentEvent[]) ?? [];
          const newEvents = global.slice(lastCount);
          for (const evt of newEvents) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
          }
          lastCount = global.length;
        } catch (err) {
          console.error('stream tick error', err);
        }
      };
      const interval = setInterval(tick, 500);
      setTimeout(
        () => {
          clearInterval(interval);
          controller.close();
        },
        5 * 60_000
      );
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'access-control-allow-origin': '*',
    },
  });
});

async function emitEvent(env: Bindings, evt: AgentEvent) {
  const key = `events:${evt.sessionId}`;
  const existing = ((await env.SESSIONS.get(key, 'json')) as AgentEvent[]) ?? [];
  existing.push(evt);
  await env.SESSIONS.put(key, JSON.stringify(existing), { expirationTtl: 60 * 60 * 6 });
  const globalKey = 'events:global';
  const global = ((await env.SESSIONS.get(globalKey, 'json')) as AgentEvent[]) ?? [];
  global.push(evt);
  await env.SESSIONS.put(globalKey, JSON.stringify(global.slice(-200)), {
    expirationTtl: 60 * 60 * 6,
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export default app;
