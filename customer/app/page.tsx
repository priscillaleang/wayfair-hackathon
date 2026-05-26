import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-white p-6 flex flex-col gap-4 max-w-md mx-auto">
      <div className="pt-6">
        <div className="text-purple-700 font-bold text-sm tracking-wider">WAYFAIR</div>
        <h1 className="text-2xl font-semibold mt-1">Delivery Inspection</h1>
        <p className="text-gray-600 mt-2 text-sm">
          A 60-second walkthrough at the doorstep protects your full-refund window. Pick the order
          you just received:
        </p>
      </div>
      <div className="flex flex-col gap-3 mt-2">
        <Link
          href="/inspect/ORD-1001"
          className="block p-4 bg-purple-700 text-white rounded-lg shadow-sm active:bg-purple-800"
        >
          <div className="font-medium">Hartley 4-Piece Sectional</div>
          <div className="text-purple-100 text-xs mt-1">Order ORD-1001 · Estes Express (LTL)</div>
        </Link>
        <Link
          href="/inspect/ORD-1002"
          className="block p-4 bg-purple-700 text-white rounded-lg shadow-sm active:bg-purple-800"
        >
          <div className="font-medium">Westbrook Console Table</div>
          <div className="text-purple-100 text-xs mt-1">
            Order ORD-1002 · Wayfair Delivery Network
          </div>
        </Link>
        <Link
          href="/inspect/ORD-1003"
          className="block p-4 bg-purple-700 text-white rounded-lg shadow-sm active:bg-purple-800"
        >
          <div className="font-medium">33&quot; Velvet Accent Chair (Set of 2)</div>
          <div className="text-purple-100 text-xs mt-1">
            Order ORD-1003 · Estes Express (LTL)
          </div>
        </Link>
      </div>
      <p className="text-xs text-gray-400 mt-6">
        Demo build · powered by Cloudflare Workers + Baseten
      </p>
    </main>
  );
}
