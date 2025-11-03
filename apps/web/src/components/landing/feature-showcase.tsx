"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FeatureSlide } from "./feature-slide";
import { cn } from "@/lib/utils";
import { useFadeIn } from "@/hooks/use-fade-in";
import { getPosthogClientBrowser } from "@nexus/analytics/client";

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
 * Beluga-style scrollable feature showcase
 * Horizontal scroll-snap carousel with minimal numeric indicators
 */
export function FeatureShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { ref, isVisible } = useFadeIn();
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll to a specific slide
  const scrollToSlide = useCallback((index: number) => {
    if (index < 0 || index >= features.length) return;
    
    const slide = slideRefs.current[index];
    const feature = features[index];
    
    if (slide && trackRef.current && feature) {
      slide.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      
      // Track navigation
      const posthog = getPosthogClientBrowser();
      if (posthog) {
        posthog.capture("feature_nav_clicked", {
          index,
          feature_id: feature.id,
        });
      }
    }
  }, []);

  // IntersectionObserver to track visible slide
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = slideRefs.current.findIndex((ref) => ref === entry.target);
            if (index >= 0 && index < features.length && index !== activeIndex) {
              const feature = features[index];
              if (!feature) return;
              
              setActiveIndex(index);
              
              // Track slide visibility
              const posthog = getPosthogClientBrowser();
              if (posthog) {
                posthog.capture("feature_slide_visible", {
                  index,
                  feature_id: feature.id,
                });
              }
            }
          }
        });
      },
      {
        root: track,
        threshold: 0.5,
      }
    );

    slideRefs.current.forEach((slide) => {
      if (slide) observer.observe(slide);
    });

    return () => {
      observer.disconnect();
    };
  }, [activeIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" && activeIndex > 0) {
        e.preventDefault();
        scrollToSlide(activeIndex - 1);
      } else if (e.key === "ArrowRight" && activeIndex < features.length - 1) {
        e.preventDefault();
        scrollToSlide(activeIndex + 1);
      }
    },
    [activeIndex, scrollToSlide]
  );

  return (
    <section
      id="features"
      ref={ref}
      className={cn(
        "py-16 sm:py-24 bg-muted/30 transition-all duration-700",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label="Feature Showcase"
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

        {/* Numeric Indicators */}
        <div className="relative mb-8 sm:mb-12">
          {/* Edge fade gradients */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-muted/30 to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/30 to-transparent pointer-events-none z-10" />
          
          {/* Scrollable indicator rail */}
          <div
            className="overflow-x-auto scrollbar-hide"
            role="tablist"
            aria-label="Feature navigation"
          >
            <div className="flex justify-center gap-2 px-8 min-w-min">
              {features.map((feature, index) => (
                <button
                  key={feature.id}
                  id={`indicator-${feature.id}`}
                  onClick={() => scrollToSlide(index)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-mono font-medium transition-all duration-200",
                    "hover:bg-accent/50 hover:text-accent-foreground min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0",
                    activeIndex === index
                      ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 scale-105"
                      : "bg-card text-muted-foreground border border-border"
                  )}
                  role="tab"
                  aria-selected={activeIndex === index}
                  aria-controls={`slide-${feature.id}`}
                  aria-label={`Slide ${feature.number}: ${feature.shortTitle}`}
                >
                  {feature.number}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Horizontal Scroll Track */}
        <div
          ref={trackRef}
          className="overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth touch-pan-x"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="presentation"
        >
          <div className="flex gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={feature.id}
                id={`slide-${feature.id}`}
                ref={(el) => {
                  slideRefs.current[index] = el;
                }}
                className="min-w-full snap-start"
                role="tabpanel"
                aria-labelledby={`indicator-${feature.id}`}
              >
                <FeatureSlide feature={feature} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

