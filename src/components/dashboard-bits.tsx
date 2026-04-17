import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label, value, hint, icon: Icon, trend, className,
}: {
  label: string; value: string | number; hint?: string; icon?: LucideIcon;
  trend?: { value: string; positive?: boolean }; className?: string;
}) {
  return (
    <Card className={cn("p-5 gradient-surface border-border", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tracking-tight font-mono">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="size-4" />
          </div>
        )}
      </div>
      {trend && (
        <div className={cn("mt-3 text-xs font-medium", trend.positive ? "text-success" : "text-destructive")}>
          {trend.positive ? "▲" : "▼"} {trend.value}
        </div>
      )}
    </Card>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <Card className="p-12 border-dashed border-border bg-muted/20">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        {Icon && <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4"><Icon className="size-5" /></div>}
        <h3 className="font-medium">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </Card>
  );
}
