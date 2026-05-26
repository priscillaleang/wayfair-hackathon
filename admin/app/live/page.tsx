"use client";
import { useEffect, useState } from "react";
import { CostPanel } from "./CostPanel";

const WORKER = process.env.NEXT_PUBLIC_WORKER_URL!;

type AgentEvent = { ts: string; sessionId: string; type: string; payload: any };

const MOCK_EVENTS: AgentEvent[] = [
  { ts: new Date(Date.now() - 50000).toISOString(), sessionId: "sess_mock", type: "session_started", payload: { order: { productName: "Hartley 4-Piece Sectional", carrier: "XPO Logistics", carrierType: "LTL", concealedDamageWindowDays: 5, value: 1849.99 } } },
  { ts: new Date(Date.now() - 40000).toISOString(), sessionId: "sess_mock", type: "step_advanced", payload: { step: 1, instruction: "Photograph the back-right corner." } },
  { ts: new Date(Date.now() - 32000).toISOString(), sessionId: "sess_mock", type: "photo_uploaded", payload: { step: 1, photoUrl: null } },
  { ts: new Date(Date.now() - 30000).toISOString(), sessionId: "sess_mock", type: "vision_called", payload: { step: 1, model: "baseten/damage-detector-v2", prompt: "Inspect this corner for concealed damage." } },
  { ts: new Date(Date.now() - 28000).toISOString(), sessionId: "sess_mock", type: "damage_detected", payload: { severity: "moderate", location: "back-right corner", description: "Crushed cardboard, visible frame dent ~4cm." } },
  { ts: new Date(Date.now() - 15000).toISOString(), sessionId: "sess_mock", type: "claim_drafted", payload: { claimId: "CLM-2026-0042", withinWindow: true, windowDeadline: "2026-05-31", draftText: "Per NMFC Item 568, carrier is liable for concealed damage reported within 5 business days of delivery. Damage observed: moderate crush to back-right corner frame..." } },
  { ts: new Date(Date.now() - 5000).toISOString(), sessionId: "sess_mock", type: "session_completed", payload: { duration: 47 } },
];

const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  session_started:  { color: "bg-blue-900",    label: "Inspection started" },
  step_advanced:    { color: "bg-slate-800",    label: "Step advanced" },
  photo_uploaded:   { color: "bg-purple-900",   label: "📸 Photo uploaded" },
  vision_called:    { color: "bg-purple-800",   label: "🧠 Vision call (Baseten)" },
  damage_detected:  { color: "bg-red-900",      label: "⚠ Damage detected" },
  claim_drafted:    { color: "bg-amber-800",    label: "📋 Claim drafted (NMFC-compliant)" },
  session_completed:{ color: "bg-emerald-800",  label: "✓ Session complete" },
};

export default function LivePage() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    const es = new EventSource(`${WORKER}/api/admin/stream`);
    let connected = false;

    es.onopen = () => { connected = true; };
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data) as AgentEvent;
      setEvents((prev) => [...prev, evt].slice(-100));
      setActive(evt.sessionId);
    };
    es.onerror = () => {
      if (!connected) {
        es.close();
        setIsMock(true);
        setEvents(MOCK_EVENTS);
        setActive("sess_mock");
      }
    };

    return () => es.close();
  }, []);

  const sessionEvents = events.filter((e) => e.sessionId === active);
  const order = sessionEvents.find((e) => e.type === "session_started")?.payload?.order;
  const damageEvents = sessionEvents.filter((e) => e.type === "damage_detected");
  const claim = sessionEvents.find((e) => e.type === "claim_drafted")?.payload;

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <header className="flex items-baseline justify-between mb-6">
        <div className="flex items-baseline gap-4">
          <h1 className="text-4xl font-bold">Agent · Live</h1>
          {isMock && (
            <span className="text-xs px-2 py-1 rounded bg-amber-900 text-amber-300">mock data</span>
          )}
        </div>
        <div className="text-sm text-slate-400 font-mono">{active ?? "Waiting for inspection…"}</div>
      </header>

      <div className="grid grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="col-span-2 space-y-3">
          {sessionEvents.length === 0 && (
            <div className="text-slate-500 py-12 text-center">Waiting for events…</div>
          )}
          {sessionEvents.map((e, i) => {
            const style = TYPE_STYLES[e.type] ?? { color: "bg-slate-800", label: e.type };
            return (
              <div key={i} className={`p-4 rounded-lg ${style.color}`}>
                <div className="flex justify-between text-xs opacity-60 mb-1">
                  <span>{new Date(e.ts).toLocaleTimeString()}</span>
                  <span className="font-mono">{e.sessionId}</span>
                </div>
                <div className="text-lg font-semibold">{style.label}</div>
                {e.type === "step_advanced" && (
                  <div className="text-sm mt-1 opacity-80">{e.payload?.instruction}</div>
                )}
                {(e.type === "vision_called" || e.type === "damage_detected" || e.type === "claim_drafted") && (
                  <pre className="text-xs mt-2 opacity-75 overflow-auto max-h-32 whitespace-pre-wrap">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {order && (
            <div className="p-4 bg-slate-900 rounded-lg">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Order</div>
              <div className="text-lg font-semibold">{order.productName}</div>
              <div className="text-sm text-slate-400 mt-1">{order.carrier} · {order.carrierType}</div>
              <div className="mt-2 text-sm">
                <span className="text-amber-400 font-bold">{order.concealedDamageWindowDays}-day</span>
                <span className="text-slate-400"> notification window</span>
              </div>
            </div>
          )}

          {damageEvents.length > 0 && (
            <div className="p-4 bg-red-950 border border-red-900 rounded-lg">
              <div className="text-xs text-red-300 uppercase tracking-wide mb-2">Damage Findings</div>
              {damageEvents.map((e, i) => (
                <div key={i} className="mt-1 text-sm">
                  <strong className="text-red-300">{e.payload?.severity ?? "reported"}</strong>
                  {e.payload?.description ? `: ${e.payload.description}` : ""}
                </div>
              ))}
            </div>
          )}

          {claim && (
            <div className="p-4 bg-amber-950 border border-amber-800 rounded-lg">
              <div className="text-xs text-amber-300 uppercase tracking-wide mb-2">Claim Drafted</div>
              <div className="text-lg font-semibold font-mono">{claim.claimId}</div>
              <div className="text-xs text-amber-200 mt-1">
                {claim.withinWindow ? "✓ Within window" : "⚠ OUTSIDE window"} · Deadline {claim.windowDeadline}
              </div>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-amber-300">View draft</summary>
                <p className="mt-2 text-amber-100 whitespace-pre-wrap opacity-80">{claim.draftText}</p>
              </details>
            </div>
          )}

          <CostPanel claim={claim} order={order} />

          {/* Vision reasoning panel */}
          {sessionEvents.some((e) => e.type === "vision_called" || e.type === "damage_detected") && (
            <div className="p-4 bg-slate-900 rounded-lg">
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Vision Reasoning</div>
              <div className="space-y-2">
                {sessionEvents
                  .filter((e) => e.type === "vision_called" || e.type === "damage_detected")
                  .map((e, i) => (
                    <div key={i} className={`p-3 rounded text-xs ${e.type === "vision_called" ? "bg-purple-950" : "bg-red-950"}`}>
                      <div className="font-semibold mb-1 opacity-70">
                        {e.type === "vision_called" ? "🧠 Vision call" : "⚠ Damage"}
                      </div>
                      <pre className="whitespace-pre-wrap opacity-80">{JSON.stringify(e.payload, null, 2)}</pre>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
