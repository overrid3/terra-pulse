import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

export function SearchInput({ value, onChange, placeholder, className, ariaLabel }: Props) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-subtle)]"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="pl-8 pr-8 h-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="clear"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
