import { cn } from "@/lib/utils";

export type CategoryTier1 = "revenue" | "cogs" | "opex" | null;

interface CategoryPillProps {
  tier1: CategoryTier1;
  tier2?: string;
  size?: "sm" | "md";
  className?: string;
}

const tier1Styles: Record<NonNullable<CategoryTier1>, string> = {
  revenue: "bg-revenue-bg text-revenue-fg",
  cogs: "bg-cogs-bg text-cogs-fg",
  opex: "bg-opex-bg text-opex-fg",
};

const tier1Labels: Record<NonNullable<CategoryTier1>, string> = {
  revenue: "Revenue",
  cogs: "COGS",
  opex: "OpEx",
};

export function CategoryPill({ tier1, tier2, size = "md", className }: CategoryPillProps) {
  if (!tier1) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          "bg-muted text-muted-foreground",
          size === "sm" && "px-2 py-0.5 text-tiny",
          className
        )}
      >
        Uncategorized
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {/* Tier 1 */}
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          tier1Styles[tier1],
          size === "sm" && "px-2 py-0.5 text-tiny"
        )}
      >
        {tier1Labels[tier1]}
      </span>

      {/* Tier 2 (if provided) */}
      {tier2 && (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            "bg-muted text-foreground",
            size === "sm" && "px-2 py-0.5 text-tiny"
          )}
        >
          {tier2}
        </span>
      )}
    </div>
  );
}
