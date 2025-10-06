"use client";

import { ChevronDown, Shield, Zap, Target } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";
import { DashboardPreview } from "./dashboard-preview";

/**
 * Hero section for landing page
 * Features value proposition, inline waitlist form, and dashboard preview
 */
export function HeroSection() {
  const handleScrollToFeatures = () => {
    const featuresSection = document.getElementById("features");
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen pt-32 pb-16 bg-gradient-to-b from-background via-background to-muted/30">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy + CTA */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                AI-powered bookkeeping for <span className="text-primary">DTC brands</span>
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl">
                Real-time P&L, automated COGS tracking, and tax-ready exports. Built for Shopify
                stores.
              </p>
            </div>

            {/* Waitlist Form */}
            <div className="max-w-md">
              <WaitlistForm inline />
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-6 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary" />
                <span>SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="w-4 h-4 text-primary" />
                <span>95%+ Accuracy</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="w-4 h-4 text-primary" />
                <span>Powered by Gemini</span>
              </div>
            </div>
          </div>

          {/* Right: Dashboard Preview */}
          <div className="order-first lg:order-last">
            <DashboardPreview />
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <button
            onClick={handleScrollToFeatures}
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
            aria-label="Scroll to features"
          >
            <span className="text-sm">Explore Features</span>
            <ChevronDown className="w-5 h-5 animate-bounce group-hover:text-primary" />
          </button>
        </div>
      </div>
    </section>
  );
}
