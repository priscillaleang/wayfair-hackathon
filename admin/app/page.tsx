import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-12 max-w-5xl mx-auto flex flex-col justify-center">
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #7c3aed, transparent 70%)" }}
      />

      <div className="relative mb-12">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-5"
          style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.35)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Wayfair Hackathon 2026
        </span>
        <h1 className="text-6xl font-bold tracking-tight mb-4" style={{ color: "#ede9fe" }}>
          Tera<span style={{ background: "linear-gradient(90deg, #a78bfa, #7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Inspect</span>
        </h1>
        <p className="text-lg max-w-xl" style={{ color: "#9ca3af" }}>
          Big-and-bulky concealed-damage inspection — real-time AI agent workflow with NMFC-compliant claim drafting.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5 relative">
        <Link
          href="/live"
          className="group relative p-8 rounded-2xl text-left transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #150d2e 0%, #1e1240 100%)",
            border: "1px solid rgba(124,58,237,0.3)",
            boxShadow: "0 0 40px rgba(124,58,237,0.08)",
          }}
        >
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ boxShadow: "0 0 40px rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.5)" }}
          />
          <div className="relative">
            <div className="text-3xl mb-4">📡</div>
            <div className="text-xl font-bold mb-2" style={{ color: "#ede9fe" }}>Live Agent View</div>
            <div className="text-sm leading-relaxed" style={{ color: "#7c6fa0" }}>
              Watch the inspection agent in real time — photo uploads, vision calls, damage detection, claim drafting.
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-xs font-medium" style={{ color: "#a78bfa" }}>
              Open live view
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        </Link>

        <Link
          href="/script-generator"
          className="group relative p-8 rounded-2xl text-left transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #0d1a12 0%, #0f2018 100%)",
            border: "1px solid rgba(16,185,129,0.2)",
            boxShadow: "0 0 40px rgba(16,185,129,0.05)",
          }}
        >
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ boxShadow: "0 0 40px rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.4)" }}
          />
          <div className="relative">
            <div className="text-3xl mb-4">🧬</div>
            <div className="text-xl font-bold mb-2" style={{ color: "#ede9fe" }}>Script Generator</div>
            <div className="text-sm leading-relaxed" style={{ color: "#4d7a61" }}>
              Subconscious simulates 10,000 customer × damage scenarios to rank inspection questions by detection ROI.
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-xs font-medium" style={{ color: "#34d399" }}>
              Run simulation
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
