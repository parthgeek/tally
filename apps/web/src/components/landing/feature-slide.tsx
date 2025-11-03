"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface FeatureSlideProps {
  feature: {
    id: string;
    number: string;
    shortTitle: string;
    headline: string;
    description: string;
    imageSrc: string;
    imageAlt: string;
  };
  isActive: boolean;
}

/**
 * Individual feature slide component
 * Left: Number indicator, headline, description
 * Right: Feature image
 */
export function FeatureSlide({ feature, isActive }: FeatureSlideProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-16 items-center transition-opacity duration-500",
        isActive ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"
      )}
    >
      {/* Left: Content */}
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Number Indicator */}
        <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono text-muted-foreground">
          <span className="text-primary font-semibold">{feature.number}</span>
          <span>/</span>
          <span>05</span>
        </div>

        {/* Headline */}
        <h3 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
          {feature.headline}
        </h3>

        {/* Description */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl">
          {feature.description}
        </p>
      </div>

      {/* Right: Image */}
      <div className="order-first lg:order-last">
        <div className="relative aspect-[4/3] rounded-xl border border-border overflow-hidden bg-card">
          {/* Placeholder with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          
          {/* Centered placeholder text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-muted-foreground text-sm font-mono">
                {feature.imageAlt}
              </div>
              <div className="text-xs text-muted-foreground/60">
                Visual placeholder
              </div>
            </div>
          </div>

          {/* Future: Replace with actual image */}
          {/* <Image
            src={feature.imageSrc}
            alt={feature.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          /> */}
        </div>
      </div>
    </div>
  );
}

