"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InfoIcon, FlagIcon } from "lucide-react";
import {
  isTwoTierTaxonomyEnabled,
  getAvailableCategories,
} from "@/lib/categorizer-lab/taxonomy-helpers";

/**
 * Display current feature flag status and taxonomy information
 */
export function FeatureStatusIndicator() {
  const isTwoTierEnabled = isTwoTierTaxonomyEnabled();
  const categories = getAvailableCategories();

  const pnlCategories = categories.filter((cat) => cat.isPnL);
  const tierOneCats = categories.filter((cat) => cat.parentId === null && cat.isPnL);
  const tierTwoCats = categories.filter((cat) => cat.parentId !== null && cat.isPnL);

  return (
    <Card className="p-4 bg-blue-50 border-blue-200 text-black">
      <div className="flex items-start gap-3">
        <FlagIcon className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-800">Taxonomy Configuration</span>
            <Badge variant={isTwoTierEnabled ? "default" : "secondary"} className="text-xs">
              {isTwoTierEnabled ? "Two-Tier Enabled" : "Legacy Mode"}
            </Badge>
          </div>

          <div className="text-sm text-blue-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">Categories Available:</span>
                <ul className="mt-1 space-y-1">
                  <li>• Total: {categories.length}</li>
                  <li>• P&L Categories: {pnlCategories.length}</li>
                  <li>• Tier 1 (Parents): {tierOneCats.length}</li>
                  <li>• Tier 2 (Children): {tierTwoCats.length}</li>
                </ul>
              </div>

              <div>
                <span className="font-medium">Parent Categories:</span>
                <ul className="mt-1 space-y-1">
                  {tierOneCats.slice(0, 4).map((cat) => (
                    <li key={cat.id} className="text-xs">
                      • {cat.name} ({categories.filter((c) => c.parentId === cat.id).length}{" "}
                      children)
                    </li>
                  ))}
                  {tierOneCats.length > 4 && (
                    <li className="text-xs text-blue-600">
                      • ... and {tierOneCats.length - 4} more
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {!isTwoTierEnabled && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
              <InfoIcon className="w-4 h-4" />
              <span className="text-xs">
                Running in legacy mode. Categories may show with full vendor-level detail.
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Simple feature flag status badge
 */
export function TaxonomyStatusBadge() {
  const isTwoTierEnabled = isTwoTierTaxonomyEnabled();

  return (
    <Badge
      variant={isTwoTierEnabled ? "default" : "secondary"}
      className="text-xs"
      title={`Taxonomy Mode: ${isTwoTierEnabled ? "Two-Tier" : "Legacy"}`}
    >
      {isTwoTierEnabled ? "2-Tier" : "Legacy"}
    </Badge>
  );
}
