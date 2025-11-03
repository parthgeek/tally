"use client";

import { useState } from "react";
import { FeatureSlide } from "./feature-slide";
import { cn } from "@/lib/utils";
import { useFadeIn } from "@/hooks/use-fade-in";

const features = [
  {
    id: "real-time-pl",
    number: "01",
    shortTitle: "Real-time P&L",
    headline: "Know What's Safe to Spend.",
    description:
      "Your actual take-home after taxes, updated live. Finally, a number you can trust when making decisions.",
    imageSrc: "/features/real-time-pl.png",
    imageAlt: "Real-time P&L Dashboard",
  },
  {
    id: "smart-categorization",
    number: "02",
    shortTitle: "Smart Categorization",
    headline: "Categorization That Gets Smarter.",
    description:
      "AI learns from your corrections. Every expense sorted into IRS categories automatically. We catch the deductions you'd miss.",
    imageSrc: "/features/smart-categorization.png",
    imageAlt: "AI-powered Smart Categorization",
  },
  {
    id: "receipts",
    number: "03",
    shortTitle: "Receipts",
    headline: "Receipts or It Didn't Happen.",
    description:
      "Attach receipts directly to transactions. Keep your records organized and audit-ready.",
    imageSrc: "/features/receipt-attachment.png",
    imageAlt: "Receipt Attachment System",
  },
  {
    id: "shopify-reconciliation",
    number: "04",
    shortTitle: "Shopify Recon",
    headline: "Shopify Payouts, Decoded.",
    description:
      "Automatically separate fees, refunds, and net revenue. Every penny accounted for with real-time payout reconciliation.",
    imageSrc: "/features/shopify-reconciliation.png",
    imageAlt: "Shopify Payout Reconciliation",
  },
  {
    id: "export",
    number: "05",
    shortTitle: "Export",
    headline: "Export to Accountant, Ready.",
    description:
      "Tax-ready exports in one click. Compatible with QuickBooks, Xero, or CSV. Your accountant will thank you.",
    imageSrc: "/features/export-options.png",
    imageAlt: "Export Options for Accountants",
  },
];

/**
 * Beluga-style numbered feature showcase with navigation pills
 * Users can click pills to navigate between features
 */
export function FeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { ref, isVisible } = useFadeIn();

  return (
    <section
      id="features"
      ref={ref}
      className={cn(
        "py-16 sm:py-24 bg-muted/30 transition-all duration-700",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            What You Get with Tally
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to keep your books clean and your accountant happy.
          </p>
        </div>

        {/* Navigation Pills */}
        <div className="flex justify-center gap-2 mb-12 flex-wrap max-w-3xl mx-auto px-2">
          {features.map((feature, index) => (
            <button
              key={feature.id}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200",
                "hover:bg-accent/50 hover:text-accent-foreground min-h-[44px] min-w-[44px] flex items-center justify-center",
                activeIndex === index
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-muted-foreground border border-border"
              )}
              aria-label={`View ${feature.shortTitle} feature`}
              aria-current={activeIndex === index ? "true" : undefined}
            >
              <span className="hidden sm:inline">{feature.shortTitle}</span>
              <span className="sm:hidden">{feature.number}</span>
            </button>
          ))}
        </div>

        {/* Feature Slides */}
        <div className="relative max-w-6xl mx-auto min-h-[500px] lg:min-h-[400px]">
          {features.map((feature, index) => (
            <FeatureSlide
              key={feature.id}
              feature={feature}
              isActive={activeIndex === index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

