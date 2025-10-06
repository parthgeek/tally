"use client";

import { Shield, Lock, Zap } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

/**
 * Final CTA section with full-width waitlist form and trust signals
 */
export function FinalCTA() {
  return (
    <section id="waitlist" className="py-24">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Copy */}
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">Ready to see your real numbers?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join the waitlist and be the first to know when we launch
          </p>

          {/* Waitlist form */}
          <div className="mb-8">
            <WaitlistForm />
          </div>

          {/* Trust signals */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>256-bit Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Powered by Gemini</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
