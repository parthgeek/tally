"use client";

import { PlVisual } from "./visuals/PlVisual";
import { CategorizationVisual } from "./visuals/CategorizationVisual";
import { ReceiptsVisual } from "./visuals/ReceiptsVisual";
import { ShopifyReconVisual } from "./visuals/ShopifyReconVisual";
import { ExportVisual } from "./visuals/ExportVisual";

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
}

/**
 * Individual feature slide component for horizontal scroll carousel
 * Left: Number indicator, headline, description
 * Right: Programmatic visual component
 */
export function FeatureSlide({ feature }: FeatureSlideProps) {
  // Map feature ID to corresponding visual component
  const renderVisual = () => {
    switch (feature.id) {
      case "real-time-pl":
        return <PlVisual />;
      case "smart-categorization":
        return <CategorizationVisual />;
      case "receipts":
        return <ReceiptsVisual />;
      case "shopify-reconciliation":
        return <ShopifyReconVisual />;
      case "export":
        return <ExportVisual />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-16 items-center">
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

      {/* Right: Programmatic Visual */}
      <div className="order-first lg:order-last">
        {renderVisual()}
      </div>
    </div>
  );
}

