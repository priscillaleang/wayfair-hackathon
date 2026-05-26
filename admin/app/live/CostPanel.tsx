export function CostPanel({ claim, order }: { claim: any; order: any }) {
  if (!claim || !order) return null;
  const claimValue = order.value ?? 0;
  const inspectionCost = 1.2;
  const recovered = claim.withinWindow ? claimValue : 0;
  const net = recovered - inspectionCost;
  return (
    <div style={{ background: "#13101f", border: "1px solid #2a2045", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 10, color: "#9080c0", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        Economic Impact
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 12px", fontSize: 13 }}>
        <span style={{ color: "#a090c0" }}>Order value</span>
        <span style={{ textAlign: "right", color: "#ede9fe" }}>${claimValue.toFixed(2)}</span>

        <span style={{ color: "#a090c0" }}>Inspection cost</span>
        <span style={{ textAlign: "right", color: "#f87171" }}>-${inspectionCost.toFixed(2)}</span>

        <span style={{ color: "#a090c0" }}>Recovered</span>
        <span style={{ textAlign: "right", color: "#34d399" }}>${recovered.toFixed(2)}</span>

        <div style={{ gridColumn: "1 / -1", height: 1, background: "#2a2045", margin: "4px 0" }} />

        <span style={{ fontWeight: 700, color: "#ede9fe" }}>Net</span>
        <span style={{ textAlign: "right", fontWeight: 700, color: net >= 0 ? "#34d399" : "#f87171" }}>
          ${net.toFixed(2)}
        </span>
      </div>
      {!claim.withinWindow && (
        <div style={{ marginTop: 12, fontSize: 11, color: "#f87171", paddingTop: 10, borderTop: "1px solid rgba(220,38,38,0.2)" }}>
          ⚠ Outside window — would have been denied without this agent.
        </div>
      )}
    </div>
  );
}
