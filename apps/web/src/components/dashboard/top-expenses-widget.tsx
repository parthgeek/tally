"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPill, type CategoryTier1 } from "@/components/ui/category-pill";
import { cn } from "@/lib/utils";

// Map category type to tier1
function getCategoryTier1(categoryType?: string | null): CategoryTier1 {
  if (!categoryType) return null;
  if (categoryType === "revenue") return "revenue";
  if (categoryType === "cogs") return "cogs";
  if (categoryType === "opex") return "opex";
  return null;
}

export interface ExpenseCategory {
  name: string;
  type?: string | null;
  amount_cents: number;
  percentage: number; // Percentage of total expenses
}

interface TopExpensesWidgetProps {
  categories: ExpenseCategory[];
  totalExpenses: number;
  className?: string;
}

export function TopExpensesWidget({
  categories,
  totalExpenses,
  className,
}: TopExpensesWidgetProps) {
  // Sort by amount and take top 5
  const topCategories = [...categories].sort((a, b) => b.amount_cents - a.amount_cents).slice(0, 5);

  const formatAmount = (amountCents: number): string => {
    const amount = amountCents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Top Expense Categories</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          {topCategories.length > 0 ? (
            topCategories.map((category, index) => {
              const tier1 = getCategoryTier1(category.type);
              const barWidth = Math.max(category.percentage, 5); // Minimum 5% for visibility

              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <CategoryPill tier1={tier1} tier2={category.name} size="sm" />
                    <span className="font-semibold tabular-nums">
                      {formatAmount(category.amount_cents)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        tier1 === "cogs" && "bg-cogs-fg",
                        tier1 === "opex" && "bg-opex-fg",
                        tier1 === "revenue" && "bg-revenue-fg",
                        !tier1 && "bg-muted-foreground"
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <div className="text-xs text-muted-foreground text-right">
                    {category.percentage.toFixed(1)}% of total
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No expense data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
