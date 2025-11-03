"use client";

import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  delta?: {
    value: string;
    isPositive: boolean;
  };
  caption?: string;
  children?: React.ReactNode;
}

export function KPICard({ title, value, delta, caption, children }: KPICardProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono">{value}</p>
        </div>
        {delta && (
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium font-mono",
              delta.isPositive
                ? "bg-success-background text-success-foreground"
                : "bg-destructive-background text-destructive-foreground"
            )}
          >
            <span>{delta.isPositive ? "▲" : "▼"}</span>
            <span>{delta.value}</span>
          </div>
        )}
      </div>
      {children}
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "muted";
  size?: "sm" | "md";
}

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md border",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        variant === "default" && "bg-card text-foreground border-border",
        variant === "success" && "bg-success-background text-success-foreground border-success/30",
        variant === "warning" && "bg-warning-background text-warning-foreground border-warning/30",
        variant === "muted" && "bg-muted text-muted-foreground border-border"
      )}
    >
      {children}
    </span>
  );
}

interface CategoryPillProps {
  children: React.ReactNode;
  color?: string;
}

export function CategoryPill({ children, color = "hsl(var(--primary))" }: CategoryPillProps) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: `${color}15`,
        color: color,
        borderColor: `${color}30`,
      }}
    >
      {children}
    </span>
  );
}

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  return (
    <div className={cn("h-2 bg-muted rounded-full overflow-hidden", className)}>
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

