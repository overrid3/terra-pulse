import React, { useCallback, useEffect, useRef, useState } from "react";

export type ResizableSplitOpts = {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

export function useResizableSplit(opts: ResizableSplitOpts) {
  const { storageKey, defaultWidth, minWidth, maxWidth } = opts;
  const panelRef = useRef<HTMLDivElement>(null);
  const initialWidth = useRef<number | null>(null);
  if (initialWidth.current === null) {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey);
    const n = raw ? Number(raw) : Number.NaN;
    initialWidth.current = Number.isFinite(n) && n >= minWidth && n <= maxWidth ? n : defaultWidth;
  }
  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    document.body.classList.add("split-resizing");
    const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const startWidth = panelRef.current?.offsetWidth ?? initialWidth.current!;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = "touches" in ev ? ev.touches[0]?.clientX : (ev).clientX;
      if (clientX == null) return;
      const next = Math.max(minWidth, Math.min(maxWidth, startWidth + (clientX - startX)));
      if (panelRef.current) panelRef.current.style.width = `${next}px`;
    };
    const onUp = () => {
      document.body.classList.remove("split-resizing");
      const raw = panelRef.current?.style.width;
      const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
      if (Number.isFinite(parsed)) localStorage.setItem(storageKey, String(parsed));
      globalThis.removeEventListener("mousemove", onMove);
      globalThis.removeEventListener("mouseup", onUp);
      globalThis.removeEventListener("touchmove", onMove);
      globalThis.removeEventListener("touchend", onUp);
    };
    globalThis.addEventListener("mousemove", onMove);
    globalThis.addEventListener("mouseup", onUp);
    globalThis.addEventListener("touchmove", onMove, { passive: false });
    globalThis.addEventListener("touchend", onUp);
  }, [minWidth, maxWidth, storageKey]);
  return { panelRef, initialWidth: initialWidth.current, startDrag };
}

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof globalThis !== "undefined" && globalThis.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );
  useEffect(() => {
    const mq = globalThis.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}
