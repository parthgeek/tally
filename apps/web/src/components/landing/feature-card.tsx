"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeatureCardProps {
  icon: LucideIcon;
  headline: string;
  description: string;
  visual?: React.ReactNode;
  className?: string;
}

/**
 * Feature card component for carousel
 */
export function FeatureCard({
  icon: Icon,
  headline,
  description,
  visual,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "flex-shrink-0 w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] snap-start",
        className
      )}
    >
      <div className="bg-card border border-border rounded-xl p-6 h-full shadow-md hover:shadow-lg transition-shadow">
        {/* Icon */}
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-primary" />
        </div>

        {/* Content */}
        <h3 className="text-xl font-semibold mb-2">{headline}</h3>
        <p className="text-muted-foreground mb-6">{description}</p>

        {/* Visual */}
        {visual && (
          <div className="rounded-lg border border-border overflow-hidden bg-muted/30">
            {visual}
          </div>
        )}
      </div>
    </div>
  );
}
