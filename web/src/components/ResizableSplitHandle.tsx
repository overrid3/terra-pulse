import React from "react";

type Props = {
  onStart: (e: React.MouseEvent | React.TouchEvent) => void;
  ariaLabel?: string;
};

export function ResizableSplitHandle({ onStart, ariaLabel = "Resize" }: Readonly<Props>) {
  return (
    <div
      className="split-handle group hidden md:flex shrink-0 w-3 cursor-col-resize items-center justify-center relative touch-none select-none"
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onMouseDown={onStart}
      onTouchStart={onStart}
      aria-hidden
    >
      <div className="w-0.5 h-9 bg-(--color-hairline) rounded-sm transition-colors group-hover:bg-(--color-brand)" />
    </div>
  );
}
