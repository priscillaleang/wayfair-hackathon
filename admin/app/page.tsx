import Link from "next/link";

export default function Home() {
  return (
    <main className="p-12 max-w-5xl mx-auto">
      <div className="mb-10">
        <div
          className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: "#7B1FA2", color: "#fff" }}
        >
          Wayfair Hackathon 2026
        </div>
        <h1 className="text-5xl font-bold mb-3">Wayfair Inspection Agent</h1>
        <p className="text-slate-400 text-lg">
          Big-and-bulky concealed-damage inspection — real-time AI agent workflow + NMFC-compliant claim drafting.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Link
          href="/live"
          className="p-8 rounded-xl text-left transition-all hover:scale-[1.02]"
          style={{ background: "#4A0080" }}
        >
          <div className="text-3xl mb-3">📡</div>
          <div className="text-2xl font-bold mb-2">Live Agent View</div>
          <div className="text-sm opacity-70">
            Watch the inspection agent in real time — photo uploads, vision calls, damage detection, claim drafting.
          </div>
        </Link>
        <Link
          href="/script-generator"
          className="p-8 bg-emerald-900 hover:bg-emerald-800 rounded-xl text-left transition-all hover:scale-[1.02]"
        >
          <div className="text-3xl mb-3">🧬</div>
          <div className="text-2xl font-bold mb-2">Script Generator</div>
          <div className="text-sm opacity-70">
            Subconscious simulates 10,000 customer × damage scenarios to rank inspection questions by detection ROI.
          </div>
        </Link>
      </div>
    </main>
  );
}
