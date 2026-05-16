const UNITS: Record<"d" | "h" | "m", number> = { d: 480, h: 60, m: 1 };
const TOKEN = /(\d+(?:\.\d+)?)([dhm])/g;
const BARE = /^\d+(?:\.\d+)?$/;

export function parseDuration(input: string): number | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (BARE.test(s)) return Math.round(parseFloat(s));

  const stripped = s.replace(/\s+/g, "");
  const tokens = [...stripped.matchAll(TOKEN)];
  if (!tokens.length) return null;
  const consumed = tokens.reduce((n, m) => n + m[0].length, 0);
  if (consumed !== stripped.length) return null;
  const total = tokens.reduce(
    (acc, m) => acc + parseFloat(m[1]) * UNITS[m[2] as "d" | "h" | "m"],
    0
  );
  return Math.round(total);
}

export function formatDuration(minutes: number): string {
  if (minutes < 0) return "0m";
  const d = Math.floor(minutes / 480);
  let r = minutes - d * 480;
  const h = Math.floor(r / 60);
  r -= h * 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (r) parts.push(`${r}m`);
  return parts.join(" ") || "0m";
}
