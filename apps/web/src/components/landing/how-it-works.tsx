"use client";

import { Link2, Eye, Download, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useFadeIn } from "@/hooks/use-fade-in";
import { cn } from "@/lib/utils";

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  time: string;
  icon: LucideIcon;
  isLast?: boolean;
}

function StepCard({ number, title, description, time, icon: Icon, isLast }: StepCardProps) {
  return (
    <div className="relative">
      {/* Connector line (hidden on mobile and last card) */}
      {!isLast && (
        <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-border z-0" />
      )}

      <div className="relative bg-card border border-border rounded-xl p-6 sm:p-8 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
        {/* Step number */}
        <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4 flex-shrink-0">
          {number}
        </div>

        {/* Icon */}
        <div className="text-primary mb-4">
          <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>

        {/* Content */}
        <h3 className="text-lg sm:text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 flex-grow">{description}</p>

        {/* Time estimate */}
        <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * How It Works section showing 3-step process
 * Connect accounts → See what's yours → Export
 */
export function HowItWorks() {
  const { ref, isVisible } = useFadeIn();
  
  const steps = [
    {
      number: 1,
      title: "Connect Accounts",
      description: "Link your Shopify store and bank accounts via Plaid. 30 seconds and you're done.",
      time: "30 seconds",
      icon: Link2,
    },
    {
      number: 2,
      title: "See What's Yours",
      description:
        "AI categorizes your transactions automatically. Review your actual profit after taxes, updated live.",
      time: "Real-time",
      icon: Eye,
    },
    {
      number: 3,
      title: "Export",
      description: "Export tax-ready data for QuickBooks, Xero, or CSV. One-click exports anytime.",
      time: "1 click",
      icon: Download,
    },
  ];

  return (
    <section
      id="how-it-works"
      ref={ref}
      className={cn(
        "py-16 sm:py-24 bg-muted/30 transition-all duration-700",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">Get started in 3 steps</h2>
          <p className="text-muted-foreground mt-3 sm:mt-4 text-base sm:text-lg">No accounting degree required</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <StepCard key={step.number} {...step} isLast={index === steps.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
