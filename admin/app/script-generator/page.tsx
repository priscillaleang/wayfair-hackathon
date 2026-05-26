"use client";
import { useState } from "react";
import type { RankedQuestion } from "@/lib/subconscious-script";

const CANDIDATE_POOL = {
  "SECT-9381": [
    { id: "q1", instruction: "Photograph the back-right corner.", promptLabel: "back_right_corner", type: "photo", estimatedSeconds: 8 },
    { id: "q2", instruction: "Photograph the cushion seam where chaise meets sofa.", promptLabel: "cushion_seam", type: "photo", estimatedSeconds: 10 },
    { id: "q3", instruction: "Slide the third drawer in and out. Did it stick?", promptLabel: "drawer_yesno", type: "yesno", estimatedSeconds: 5 },
    { id: "q4", instruction: "Photograph the front-left leg.", promptLabel: "front_left_leg", type: "photo", estimatedSeconds: 8 },
    { id: "q5", instruction: "Anything else look wrong?", promptLabel: "optional_other", type: "photo_optional", estimatedSeconds: 12 },
    { id: "q6", instruction: "Photograph the underside frame.", promptLabel: "underside_frame", type: "photo", estimatedSeconds: 15 },
    { id: "q7", instruction: "Photograph the seat-back joint.", promptLabel: "seat_back_joint", type: "photo", estimatedSeconds: 9 },
  ],
} as const;

const SKU_NAMES: Record<string, string> = { "SECT-9381": "Hartley 4-Piece Sectional" };

const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  photo:          { bg: "rgba(109,40,217,0.2)",  color: "#a78bfa" },
  photo_optional: { bg: "rgba(75,63,114,0.2)",   color: "#7c6fa0" },
  yesno:          { bg: "rgba(59,130,246,0.15)", color: "#93c5fd" },
};

export default function ScriptGen() {
  const sku = "SECT-9381";
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ranked: RankedQuestion[]; source: string } | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    const res = await fetch("/api/script-gen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sku, productName: SKU_NAMES[sku], candidatePool: CANDIDATE_POOL[sku] }),
    });
    setResult(await res.json());
    setRunning(false);
  }

  const selected = result?.ranked.slice(0, 5);
  const totalTime = selected?.reduce((s, q) => s + q.estimatedSeconds, 0);

  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: 500, height: 250, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.12), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#ede9fe", marginBottom: 8 }}>
          Inspection Script Generator
        </h1>
        <p style={{ fontSize: 15, color: "#6d5fa0", lineHeight: 1.6 }}>
          Subconscious scores each candidate question against damage scenarios for this SKU.
          We pick the{" "}
          <span style={{ color: "#34d399", fontWeight: 600 }}>top 5</span>
          {" "}by detection probability per second.
        </p>
      </div>

      {/* Control bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 28, padding: "16px 20px", background: "#13101f", border: "1px solid #2a2045", borderRadius: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: "#6d5fa0", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>SKU</div>
          <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 15, color: "#a78bfa" }}>{sku}</div>
        </div>
        <div style={{ width: 1, height: 32, background: "#2a2045" }} />
        <div>
          <div style={{ fontSize: 10, color: "#6d5fa0", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Product</div>
          <div style={{ fontSize: 15, color: "#ede9fe" }}>{SKU_NAMES[sku]}</div>
        </div>
        <div style={{ width: 1, height: 32, background: "#2a2045" }} />
        <div>
          <div style={{ fontSize: 10, color: "#6d5fa0", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Candidates</div>
          <div style={{ fontSize: 15, color: "#ede9fe" }}>{CANDIDATE_POOL[sku].length} questions</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={run}
            disabled={running}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              border: "none",
              cursor: running ? "default" : "pointer",
              background: running ? "#2a2045" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: running ? "#6d5fa0" : "#fff",
              boxShadow: running ? "none" : "0 0 20px rgba(124,58,237,0.4)",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {running ? (
              <>
                <span style={{ width: 14, height: 14, border: "2px solid #6d5fa0", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                Simulating…
              </>
            ) : "Run simulation"}
          </button>
        </div>
      </div>

      {result && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#6d5fa0" }}>
              Source:{" "}
              <span style={{ color: result.source === "subconscious" ? "#a78bfa" : "#fbbf24", fontWeight: 600 }}>
                {result.source === "subconscious" ? "Subconscious TIM" : "Monte Carlo fallback"}
              </span>
            </div>
            {totalTime && (
              <div style={{ fontSize: 13, color: "#6d5fa0" }}>
                Script total time: <span style={{ color: "#34d399", fontWeight: 600 }}>{totalTime}s</span>
              </div>
            )}
          </div>

          <div style={{ background: "#13101f", border: "1px solid #2a2045", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2a2045" }}>
                  {["#", "Question", "Type", "Detection ROI", "Sec", "✓"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", fontSize: 10, color: "#4b3f72", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: h === "✓" ? "center" : "left", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.ranked.map((q, i) => {
                  const badge = TYPE_BADGE[q.type] ?? TYPE_BADGE.photo_optional;
                  const isSelected = i < 5;
                  return (
                    <tr key={q.id} style={{ borderBottom: "1px solid #1a1530", background: isSelected ? "rgba(124,58,237,0.04)" : "transparent", opacity: isSelected ? 1 : 0.4 }}>
                      <td style={{ padding: "14px 16px", fontSize: 20, fontWeight: 700, color: isSelected ? "#7c3aed" : "#4b3f72", width: 48 }}>{q.rank}</td>
                      <td style={{ padding: "14px 16px", fontSize: 14, color: "#c4b5fd" }}>{q.instruction}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontFamily: "var(--font-geist-mono)", background: badge.bg, color: badge.color }}>
                          {q.type}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ height: 4, borderRadius: 2, background: isSelected ? "#7c3aed" : "#2a2045", width: Math.round((q.detectionROI / result.ranked[0].detectionROI) * 72) }} />
                          <span style={{ fontSize: 13, color: "#34d399", fontVariantNumeric: "tabular-nums" }}>
                            {(q.detectionROI * 100).toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#7c6fa0", fontVariantNumeric: "tabular-nums" }}>{q.estimatedSeconds}s</td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 16, color: isSelected ? "#34d399" : "#2a2045" }}>{isSelected ? "✓" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
