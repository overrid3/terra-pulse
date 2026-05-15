import { useState } from "react";
import { useTranslation } from "react-i18next";
import { geoApi, GeocodeResult } from "../api/geo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  onPick: (hit: GeocodeResult) => void;
  onChange?: (text: string) => void;
  placeholder?: string;
};

export function AddressLookup({ onPick, onChange, placeholder }: Props) {
  const { t } = useTranslation();
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
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 items-center">
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); onChange?.(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
          placeholder={placeholder ?? t("address.placeholderFallback")}
        />
        <Button type="button" variant="outline" onClick={() => void search()} disabled={busy || !q.trim()}>
          {busy ? "…" : t("common.find")}
        </Button>
      </div>
      {err && <p className="text-[var(--text-sm)] text-[var(--color-danger)] m-0">{err}</p>}
      {hits && hits.length === 0 && <p className="text-[var(--text-sm)] text-[var(--color-text-muted)] m-0">{t("address.noMatches")}</p>}
      {hits && hits.length > 0 && (
        <ul className="list-none p-0 m-0 max-h-[180px] overflow-auto border border-[var(--color-hairline)] rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)]">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`} className="border-b border-[var(--color-hairline)] last:border-b-0">
              <button
                type="button"
                onClick={() => pick(h)}
                className="block w-full text-left px-2 py-1.5 bg-transparent border-none cursor-pointer text-[var(--text-sm)] text-[var(--color-text)] hover:bg-[var(--color-neutral-bg)] transition-colors"
              >
                <span className="font-mono">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</span>
                <span> · {h.displayName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
