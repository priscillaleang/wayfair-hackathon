'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const WORKER = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787';

type Step = {
  index: number;
  instruction: string;
  type: 'photo' | 'photo_optional' | 'yesno';
  promptLabel?: string;
};

type Order = {
  orderId: string;
  productName: string;
  carrier: string;
  carrierType: string;
  concealedDamageWindowDays: number;
  proNumber: string;
  bolNumber: string;
};

type PhotoResult = {
  stepIndex: number;
  validation?: { matchesPrompt: boolean; confidence: number };
  damage?: {
    detected: boolean;
    severity: string;
    location: string;
    description: string;
  };
  answer?: 'yes' | 'no';
};

type CompleteResult =
  | { outcome: 'clean' }
  | {
      outcome: 'damage_found';
      claim: {
        claimId: string;
        carrier: string;
        draftText: string;
        filedAt: string;
        withinWindow: boolean;
        windowDeadline: string;
      };
    };

export default function InspectPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId;

  const [session, setSession] = useState<{ sessionId: string; steps: Step[]; order: Order } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [results, setResults] = useState<PhotoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState<CompleteResult | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetch(`${WORKER}/api/inspect/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`start failed: ${r.status} ${await r.text()}`);
        return r.json();
      })
      .then(setSession)
      .catch((e) => setError(String(e)));
  }, [orderId]);

  if (error) {
    return (
      <main className="min-h-screen p-6 max-w-md mx-auto">
        <h1 className="text-xl font-semibold text-red-700">Couldn&apos;t start inspection</h1>
        <p className="text-sm text-gray-600 mt-2 break-words">{error}</p>
        <p className="text-xs text-gray-400 mt-4">Worker URL: {WORKER}</p>
      </main>
    );
  }
  if (!session) {
    return (
      <main className="min-h-screen p-6 max-w-md mx-auto flex items-center justify-center">
        <div className="text-gray-500">Loading inspection…</div>
      </main>
    );
  }
  if (complete) {
    return <Complete result={complete} order={session.order} />;
  }

  const step = session.steps[stepIdx];

  async function submitPhoto(file: File) {
    if (!session) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('sessionId', session.sessionId);
      fd.append('stepIndex', String(stepIdx));
      fd.append('photo', file);
      const res = await fetch(`${WORKER}/api/inspect/photo`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`photo upload failed: ${res.status}`);
      const data: PhotoResult = await res.json();
      setResults((r) => [...r, data]);
      await advance();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(answer: 'yes' | 'no') {
    if (!session) return;
    setBusy(true);
    try {
      const res = await fetch(`${WORKER}/api/inspect/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, stepIndex: stepIdx, answer }),
      });
      if (!res.ok) throw new Error(`answer failed: ${res.status}`);
      setResults((r) => [...r, { stepIndex: stepIdx, answer }]);
      await advance();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function skipOptional() {
    if (!session) return;
    setResults((r) => [...r, { stepIndex: stepIdx, answer: 'no' }]);
    await advance();
  }

  async function advance() {
    if (!session) return;
    if (stepIdx + 1 < session.steps.length) {
      setStepIdx(stepIdx + 1);
    } else {
      const res = await fetch(`${WORKER}/api/inspect/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      if (!res.ok) {
        setError(`complete failed: ${res.status}`);
        return;
      }
      setComplete(await res.json());
    }
  }

  const progress = Math.round(((stepIdx) / session.steps.length) * 100);

  return (
    <main className="min-h-screen bg-white p-6 max-w-md mx-auto flex flex-col">
      <header className="mb-4">
        <div className="text-purple-700 font-bold text-xs tracking-wider">WAYFAIR INSPECTION</div>
        <div className="text-sm text-gray-500 mt-1">{session.order.productName}</div>
        <div className="text-lg font-semibold mt-1">
          Step {stepIdx + 1} of {session.steps.length}
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-purple-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="p-4 bg-purple-50 rounded-lg mb-6 text-lg leading-snug">
        {step.instruction}
      </div>

      {step.type === 'photo' || step.type === 'photo_optional' ? (
        <div className="flex flex-col gap-3">
          <label
            className={`block w-full p-8 border-2 border-dashed rounded-lg text-center font-medium ${
              busy
                ? 'border-gray-200 text-gray-400'
                : 'border-purple-300 text-purple-700 active:bg-purple-50'
            }`}
          >
            {busy ? 'Analyzing…' : '📷 Tap to take photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && submitPhoto(e.target.files[0])}
              disabled={busy}
            />
          </label>
          {step.type === 'photo_optional' && !busy && (
            <button
              onClick={skipOptional}
              className="text-sm text-gray-500 underline"
            >
              Nothing to flag — skip
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => submitAnswer('yes')}
            disabled={busy}
            className="flex-1 p-4 bg-red-600 text-white rounded-lg font-medium active:bg-red-700 disabled:opacity-50"
          >
            Yes, something&apos;s off
          </button>
          <button
            onClick={() => submitAnswer('no')}
            disabled={busy}
            className="flex-1 p-4 bg-green-600 text-white rounded-lg font-medium active:bg-green-700 disabled:opacity-50"
          >
            No, works fine
          </button>
        </div>
      )}

      {results.length > 0 && <ResultsList results={results} />}
    </main>
  );
}

function ResultsList({ results }: { results: PhotoResult[] }) {
  return (
    <div className="mt-6 space-y-2">
      <div className="text-xs uppercase tracking-wider text-gray-400">Findings so far</div>
      {results.map((r, i) => {
        const isDamage = r.damage?.detected || r.answer === 'yes';
        return (
          <div
            key={i}
            className={`p-3 rounded text-sm ${
              isDamage ? 'bg-red-50 text-red-900' : 'bg-green-50 text-green-900'
            }`}
          >
            <span className="font-medium">Step {i + 1}: </span>
            {r.damage?.detected
              ? `⚠ ${r.damage.severity} damage — ${r.damage.description}`
              : r.answer === 'yes'
                ? '⚠ Issue reported'
                : '✓ Clear'}
          </div>
        );
      })}
    </div>
  );
}

function Complete({ result, order }: { result: CompleteResult; order: Order }) {
  if (result.outcome === 'clean') {
    return (
      <main className="min-h-screen bg-green-50 p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="text-6xl mb-4">✓</div>
        <h1 className="text-2xl font-semibold">All good</h1>
        <p className="text-gray-700 mt-2">
          Your inspection is on file. If something turns up later, you&apos;re covered.
        </p>
        <a href="/" className="mt-8 text-purple-700 underline">
          Back to start
        </a>
      </main>
    );
  }
  const { claim } = result;
  return (
    <main className="min-h-screen bg-white p-6 max-w-md mx-auto">
      <div className="text-3xl mb-2">📋 Claim drafted</div>
      <div className="text-gray-600 mb-1 text-sm">
        Reference <strong>{claim.claimId}</strong>
      </div>
      <div className="text-gray-600 mb-4 text-sm">
        Filed within {order.carrier} window ({order.concealedDamageWindowDays} days). Deadline:{' '}
        <strong>{claim.windowDeadline}</strong>.
      </div>
      <div
        className={`mb-4 inline-block px-2 py-1 rounded text-xs font-medium ${
          claim.withinWindow ? 'bg-green-100 text-green-900' : 'bg-yellow-100 text-yellow-900'
        }`}
      >
        {claim.withinWindow ? '✓ Within carrier window' : '⚠ Outside window'}
      </div>
      <pre className="whitespace-pre-wrap bg-gray-50 p-4 rounded text-xs leading-relaxed border border-gray-200">
        {claim.draftText}
      </pre>
      <a href="/" className="mt-6 inline-block text-purple-700 underline text-sm">
        Back to start
      </a>
    </main>
  );
}
