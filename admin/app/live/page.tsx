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

type EventStyle = { border: string; dot: string; label: string };
const TYPE_STYLES: Record<string, EventStyle> = {
  session_started:   { border: "#3b82f6", dot: "#60a5fa", label: "Inspection started" },
  step_advanced:     { border: "#4b5563", dot: "#9ca3af", label: "Step advanced" },
  photo_uploaded:    { border: "#7c3aed", dot: "#a78bfa", label: "📸 Photo uploaded" },
  vision_called:     { border: "#6d28d9", dot: "#8b5cf6", label: "🧠 Vision call · Baseten" },
  damage_detected:   { border: "#dc2626", dot: "#f87171", label: "⚠ Damage detected" },
  claim_drafted:     { border: "#d97706", dot: "#fbbf24", label: "📋 Claim drafted · NMFC-compliant" },
  session_completed: { border: "#059669", dot: "#34d399", label: "✓ Session complete" },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#13101f", border: "1px solid #2a2045", borderRadius: 12, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: "#9080c0", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{children}</div>;
}

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
    <main style={{ padding: "32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isMock ? "#f59e0b" : "#34d399", boxShadow: isMock ? "0 0 8px #f59e0b" : "0 0 8px #34d399", display: "inline-block" }} />
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#ede9fe", margin: 0 }}>Agent · Live</h1>
          </div>
          {isMock && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" }}>
              mock data
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "#8070b0", fontFamily: "var(--font-geist-mono)" }}>
          {active ?? "Waiting for inspection…"}
        </span>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessionEvents.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#4b3f72" }}>
              Waiting for events…
            </div>
          )}
          {sessionEvents.map((e, i) => {
            const s = TYPE_STYLES[e.type] ?? { border: "#4b5563", dot: "#9ca3af", label: e.type };
            return (
              <div key={i} style={{ background: "#13101f", border: `1px solid #2a2045`, borderLeft: `3px solid ${s.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#f5f0ff" }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "#7060a0", fontFamily: "var(--font-geist-mono)", marginLeft: 14, marginBottom: 4 }}>
                  {new Date(e.ts).toLocaleTimeString()}
                </div>
                {e.type === "step_advanced" && (
                  <div style={{ fontSize: 13, color: "#b0a0d8", marginLeft: 14 }}>{e.payload?.instruction}</div>
                )}
                {(e.type === "vision_called" || e.type === "damage_detected" || e.type === "claim_drafted") && (
                  <pre style={{ fontSize: 11, color: "#a090c8", marginTop: 8, marginLeft: 14, overflow: "auto", maxHeight: 100, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {order && (
            <Card>
              <Label>Order</Label>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#ede9fe" }}>{order.productName}</div>
              <div style={{ fontSize: 13, color: "#9080c0", marginTop: 4 }}>{order.carrier} · {order.carrierType}</div>
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <span style={{ color: "#a78bfa", fontWeight: 700 }}>{order.concealedDamageWindowDays}-day</span>
                <span style={{ color: "#8070b0" }}> notification window</span>
              </div>
            </Card>
          )}

          {damageEvents.length > 0 && (
            <Card style={{ borderColor: "rgba(220,38,38,0.35)", background: "rgba(20,8,8,0.8)" }}>
              <Label>Damage Findings</Label>
              {damageEvents.map((e, i) => (
                <div key={i} style={{ fontSize: 13, marginTop: i > 0 ? 8 : 0 }}>
                  <span style={{ color: "#f87171", fontWeight: 600 }}>{e.payload?.severity ?? "reported"}</span>
                  {e.payload?.description ? <span style={{ color: "#9ca3af" }}>: {e.payload.description}</span> : null}
                </div>
              ))}
            </Card>
          )}

          {claim && (
            <Card style={{ borderColor: "rgba(217,119,6,0.35)", background: "rgba(20,14,4,0.8)" }}>
              <Label>Claim Drafted</Label>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-geist-mono)", color: "#fbbf24" }}>{claim.claimId}</div>
              <div style={{ fontSize: 12, color: "#92400e", marginTop: 6 }}>
                {claim.withinWindow
                  ? <span style={{ color: "#34d399" }}>✓ Within window</span>
                  : <span style={{ color: "#f87171" }}>⚠ OUTSIDE window</span>}
                {" "}· Deadline {claim.windowDeadline}
              </div>
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontSize: 12, color: "#d97706", cursor: "pointer" }}>View draft</summary>
                <p style={{ fontSize: 11, color: "#92400e", marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{claim.draftText}</p>
              </details>
            </Card>
          )}

          <CostPanel claim={claim} order={order} />

          {sessionEvents.some((e) => e.type === "vision_called" || e.type === "damage_detected") && (
            <Card>
              <Label>Vision Reasoning</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessionEvents
                  .filter((e) => e.type === "vision_called" || e.type === "damage_detected")
                  .map((e, i) => (
                    <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: e.type === "vision_called" ? "rgba(109,40,217,0.12)" : "rgba(220,38,38,0.08)", border: `1px solid ${e.type === "vision_called" ? "rgba(109,40,217,0.25)" : "rgba(220,38,38,0.2)"}` }}>
                      <div style={{ fontSize: 11, color: e.type === "vision_called" ? "#8b5cf6" : "#f87171", marginBottom: 6, fontWeight: 600 }}>
                        {e.type === "vision_called" ? "🧠 Vision call" : "⚠ Damage"}
                      </div>
                      <pre style={{ fontSize: 10, color: "#a090c8", whiteSpace: "pre-wrap" }}>{JSON.stringify(e.payload, null, 2)}</pre>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
