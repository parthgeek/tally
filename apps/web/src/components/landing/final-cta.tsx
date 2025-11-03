"use client";

import { Shield, Lock, Zap } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

/**
 * Final CTA section with waitlist form and trust signals
 * Beluga-style with purple glow effect
 */
export function FinalCTA() {
  return (
    <section id="waitlist" className="relative py-16 sm:py-24 bg-background">
      {/* Purple glow effect */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50%_50%_at_50%_50%,hsl(var(--primary)/0.1),transparent)]" />

      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Copy */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Stop guessing. Start knowing.
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground mb-6 sm:mb-8">
            Join the waitlist and be the first to experience bookkeeping that doesn't suck.
          </p>

          {/* Waitlist form */}
          <div className="mb-8">
            <WaitlistForm />
          </div>

          {/* Trust signals */}
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary flex-shrink-0" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary flex-shrink-0" />
              <span>Bank-level Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary flex-shrink-0" />
              <span>30-second Setup</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
