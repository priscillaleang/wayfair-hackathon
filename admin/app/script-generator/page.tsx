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

const SKU_NAMES: Record<string, string> = {
  "SECT-9381": "Hartley 4-Piece Sectional",
};

const TYPE_BADGE: Record<string, string> = {
  photo:          "bg-purple-900 text-purple-200",
  photo_optional: "bg-slate-700 text-slate-300",
  yesno:          "bg-blue-900 text-blue-200",
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
      body: JSON.stringify({
        sku,
        productName: SKU_NAMES[sku],
        candidatePool: CANDIDATE_POOL[sku],
      }),
    });
    setResult(await res.json());
    setRunning(false);
  }

  const selected = result?.ranked.slice(0, 5);
  const totalTime = selected?.reduce((s, q) => s + q.estimatedSeconds, 0);

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Inspection Script Generator</h1>
        <p className="text-slate-400">
          Subconscious scores each candidate question against damage scenarios for this SKU.
          We pick the <span className="text-emerald-400 font-semibold">top 5</span> by detection probability per second.
        </p>
      </div>

      <div className="flex items-center gap-6 mb-8 p-4 bg-slate-900 rounded-lg">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">SKU</div>
          <div className="font-mono text-lg">{sku}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Product</div>
          <div className="text-lg">{SKU_NAMES[sku]}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Candidates</div>
          <div className="text-lg">{CANDIDATE_POOL[sku].length} questions</div>
        </div>
        <div className="ml-auto">
          <button
            onClick={run}
            disabled={running}
            className="px-8 py-3 rounded-lg font-semibold text-lg transition-all disabled:opacity-50"
            style={{ background: running ? "#555" : "#7B1FA2" }}
          >
            {running ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Simulating…
              </span>
            ) : (
              "Run simulation"
            )}
          </button>
        </div>
      </div>

      {result && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-slate-400">
              Source:{" "}
              <span className={result.source === "subconscious" ? "text-purple-400" : "text-amber-400"}>
                {result.source === "subconscious" ? "Subconscious TIM" : "Monte Carlo fallback"}
              </span>
            </div>
            {totalTime && (
              <div className="text-sm text-slate-400">
                Selected script total time:{" "}
                <span className="text-emerald-400 font-semibold">{totalTime}s</span>
              </div>
            )}
          </div>

          <table className="w-full text-left">
            <thead className="text-xs text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="py-2 w-10">#</th>
                <th>Question</th>
                <th className="w-24">Type</th>
                <th className="w-32">Detection ROI</th>
                <th className="w-20">Seconds</th>
                <th className="w-20 text-center">In script</th>
              </tr>
            </thead>
            <tbody>
              {result.ranked.map((q, i) => (
                <tr
                  key={q.id}
                  className={`border-b border-slate-900 ${i < 5 ? "bg-emerald-950/30" : "opacity-40"}`}
                >
                  <td className="py-3 text-2xl font-bold text-slate-500">{q.rank}</td>
                  <td className="pr-4">{q.instruction}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${TYPE_BADGE[q.type]}`}>
                      {q.type}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded bg-emerald-500"
                        style={{
                          width: `${Math.round((q.detectionROI / result.ranked[0].detectionROI) * 80)}px`,
                        }}
                      />
                      <span className="text-emerald-400 text-sm tabular-nums">
                        {(q.detectionROI * 100).toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="tabular-nums">{q.estimatedSeconds}s</td>
                  <td className="text-center text-xl">{i < 5 ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
