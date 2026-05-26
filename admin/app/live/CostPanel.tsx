export function CostPanel({ claim, order }: { claim: any; order: any }) {
  if (!claim || !order) return null;
  const claimValue = order.value ?? 0;
  const inspectionCost = 1.2;
  const recovered = claim.withinWindow ? claimValue : 0;
  const net = recovered - inspectionCost;
  return (
    <div className="p-4 bg-slate-900 rounded-lg">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Economic Impact</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-slate-300">Order value</div>
        <div className="text-right">${claimValue.toFixed(2)}</div>
        <div className="text-slate-300">Inspection cost</div>
        <div className="text-right text-red-400">-${inspectionCost.toFixed(2)}</div>
        <div className="text-slate-300">Recovered</div>
        <div className="text-right text-emerald-400">${recovered.toFixed(2)}</div>
        <div className="font-bold border-t border-slate-700 pt-2">Net</div>
        <div className={`text-right font-bold border-t border-slate-700 pt-2 ${net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          ${net.toFixed(2)}
        </div>
      </div>
      {!claim.withinWindow && (
        <div className="mt-3 text-xs text-red-400">
          ⚠ Outside window — would have been denied without this agent.
        </div>
      )}
    </div>
  );
}
