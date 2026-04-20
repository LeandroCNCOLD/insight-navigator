import { Home, Users, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export type OriginValue = "all" | "house" | "rival";

const OPTIONS: { value: OriginValue; label: string; icon: typeof Filter }[] = [
  { value: "all", label: "Todos", icon: Filter },
  { value: "house", label: "CN Cold", icon: Home },
  { value: "rival", label: "Concorrentes", icon: Users },
];

export function OriginFilter({
  value,
  onChange,
  counts,
  className,
}: {
  value: OriginValue;
  onChange: (v: OriginValue) => void;
  counts?: { all?: number; house?: number; rival?: number };
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-md border bg-muted/30 p-0.5 gap-0.5", className)}>
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        const count = counts?.[opt.value];
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
              active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {opt.label}
            {typeof count === "number" && (
              <span className={cn("ml-0.5 text-[10px]", active ? "text-muted-foreground" : "opacity-60")}>
                ({count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Determines if a proposal row (with .competitor.is_house joined) is from CN Cold. */
export function isHouseRow(row: { competitor?: { is_house?: boolean | null } | null }): boolean {
  return !!row.competitor?.is_house;
}

/** Filters an array of proposal-like rows by origin. */
export function filterByOrigin<T extends { competitor?: { is_house?: boolean | null } | null }>(
  rows: T[],
  origin: OriginValue,
): T[] {
  if (origin === "all") return rows;
  if (origin === "house") return rows.filter(isHouseRow);
  return rows.filter((r) => !isHouseRow(r));
}
