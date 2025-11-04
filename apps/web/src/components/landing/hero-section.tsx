"use client";

import { ChevronDown, Users, Zap, Store } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

/**
 * Hero section for landing page
 * Features centered text layout with bold tagline, value proposition, and inline waitlist form
 * Beluga-style: No dashboard preview, text-focused with purple glow effect
 */
export function HeroSection() {
  const handleScrollToFeatures = () => {
    const featuresSection = document.getElementById("features");
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen bg-background flex items-center justify-center">
      {/* Purple glow effect */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_-10%,hsl(var(--primary)/0.15),transparent)]" />
      
      <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-24">
        <div className="max-w-5xl mx-auto text-center">
          {/* Big Bold Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 sm:mb-8">
            Never clean up your books again.
          </h1>
          
          {/* Supporting Text */}
          <p className="text-xl sm:text-2xl md:text-3xl text-muted-foreground max-w-4xl mx-auto mb-10 sm:mb-12 leading-relaxed">
            Tally is bookkeeping and taxes for e-commerce brands made simple. Connect your bank and Shopify to get clean, automated books, real-time profit insights, and stay tax-ready year-round — no spreadsheets, no stress.
          </p>
          
          {/* Waitlist Form */}
          <div className="max-w-md mx-auto mb-10 sm:mb-12">
            <WaitlistForm inline />
          </div>
          
          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8 text-sm sm:text-base text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary flex-shrink-0" />
              <span>60+ Founders on waitlist</span>
            </div>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary flex-shrink-0" />
              <span>Built for Shopify brands</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary flex-shrink-0" />
              <span>Private beta — join the waitlist</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:block">
        <button
          onClick={handleScrollToFeatures}
          className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors group min-h-[44px]"
          aria-label="Scroll to features"
        >
          <span className="text-sm">Explore Features</span>
          <ChevronDown className="w-5 h-5 animate-bounce group-hover:text-primary" />
        </button>
      </div>
    </section>
  );
}
