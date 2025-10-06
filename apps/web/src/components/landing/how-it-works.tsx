"use client";

import { Link2, Eye, Download, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

      <div className="relative bg-card border border-border rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow">
        {/* Step number */}
        <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
          {number}
        </div>

        {/* Icon */}
        <div className="text-primary mb-4">
          <Icon className="w-8 h-8" />
        </div>

        {/* Content */}
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{description}</p>

        {/* Time estimate */}
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * How It Works section showing 3-step onboarding process
 */
export function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: "Connect Shopify and Bank Account(s)",
      description: "Link your Shopify store in 60 seconds. Bank account connections via Plaid.",
      time: "1 minute",
      icon: Link2,
    },
    {
      number: 2,
      title: "Review Dashboard",
      description:
        "AI categorizes your transactions automatically. Review and approve in 5 minutes.",
      time: "5 minutes",
      icon: Eye,
    },
    {
      number: 3,
      title: "Export Reports",
      description: "Tax-ready data for QuickBooks, Xero, or CSV. One-click exports anytime.",
      time: "1 click",
      icon: Download,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Get started in 3 steps</h2>
          <p className="text-muted-foreground mt-4 text-lg">No accounting degree required</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <StepCard key={step.number} {...step} isLast={index === steps.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
