import { useState } from "react";
import { geoApi, GeocodeResult } from "../api/geo";

type Props = {
  onPick: (hit: GeocodeResult) => void;
  placeholder?: string;
};

export function AddressLookup({ onPick, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<GeocodeResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) return;
    setBusy(true); setErr(null); setHits(null);
    try {
      const res = await geoApi.geocode(q);
      setHits(res);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function pick(h: GeocodeResult) {
    onPick(h);
    setHits(null);
    setQ(h.displayName);
  }

  return (
    <div className="address-lookup">
      <div className="address-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
          placeholder={placeholder ?? "Search address (e.g. Piazza Duomo Milano)"}
        />
        <button type="button" onClick={search} disabled={busy || !q.trim()}>
          {busy ? "…" : "Find"}
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {hits && hits.length === 0 && <p className="muted">no matches</p>}
      {hits && hits.length > 0 && (
        <ul className="address-hits">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`}>
              <button type="button" className="ghost" onClick={() => pick(h)}>
                <span className="mono">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</span>
                <span> · {h.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
