"use client";

import { Sparkles, TrendingUp, Package, DollarSign } from "lucide-react";
import { FeatureCard } from "./feature-card";
import { CategoryPill } from "@/components/ui/category-pill";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";

/**
 * Feature carousel showcasing 4 key features
 */
export function FeatureCarousel() {
  const features = [
    {
      id: "ai-categorization",
      icon: Sparkles,
      headline: "Smart categorization with 95%+ accuracy",
      description:
        "Google Gemini AI automatically categorizes transactions into 38 e-commerce categories. No manual data entry.",
      visual: (
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium">Shopify Payment</p>
              <div className="flex items-center gap-2">
                <CategoryPill tier1="revenue" tier2="DTC Sales" />
                <ConfidenceBadge confidence={0.98} />
              </div>
            </div>
            <span className="text-sm font-mono font-semibold text-green-600">+$2,450</span>
          </div>
        </div>
      ),
    },
    {
      id: "realtime-pl",
      icon: TrendingUp,
      headline: "Know your numbers every day",
      description:
        "Real-time profit & loss statements with revenue, COGS, and margin tracking. No month-end waiting.",
      visual: (
        <div className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Revenue</span>
              <span className="text-sm font-mono font-semibold">$124,382</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">COGS</span>
              <span className="text-sm font-mono font-semibold">$52,180</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Gross Margin</span>
              <span className="text-sm font-mono font-bold text-primary">58.1%</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "cogs-tracking",
      icon: Package,
      headline: "True profitability, not just revenue",
      description:
        "Track inventory costs, packaging, and freight. See your real gross margins instantly.",
      visual: (
        <div className="p-4">
          <div className="space-y-2">
            <div className="h-4 bg-orange-200 rounded-full overflow-hidden">
              <div className="h-full bg-orange-600 w-[42%]" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cost of Goods: 42%</span>
              <span>Margin: 58%</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "shopify-reconciliation",
      icon: DollarSign,
      headline: "Shopify payouts, decoded",
      description:
        "Automatically separate fees, refunds, and net revenue. Every penny accounted for.",
      visual: (
        <div className="p-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross Sales</span>
            <span className="font-mono">$5,240.00</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Shopify Fees</span>
            <span className="font-mono">-$156.80</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>Processing Fees</span>
            <span className="font-mono">-$143.20</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between font-semibold">
            <span>Net Payout</span>
            <span className="font-mono text-green-600">$4,940.00</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide">
            Built for E-commerce
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mt-2">
            Every feature designed for DTC brands
          </h2>
        </div>

        {/* Carousel - horizontal scroll on mobile, grid on desktop */}
        <div className="relative">
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 md:gap-6 pb-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
            {features.map((feature) => (
              <FeatureCard key={feature.id} {...feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
