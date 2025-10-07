import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewFilters } from "@nexus/types";

interface ReviewFiltersProps {
  filters: ReviewFilters;
  onChange: (filters: ReviewFilters) => void;
  className?: string;
}

export function ReviewFiltersComponent({ filters, onChange, className }: ReviewFiltersProps) {
  const updateFilter = <K extends keyof ReviewFilters>(key: K, value: ReviewFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({
      needsReviewOnly: true,
      minConfidence: 0,
      maxConfidence: 1,
    });
  };

  const hasActiveFilters =
    !filters.needsReviewOnly ||
    filters.minConfidence > 0 ||
    filters.maxConfidence < 1 ||
    filters.dateFrom ||
    filters.dateTo ||
    (filters.categoryIds && filters.categoryIds.length > 0);

  return (
    <Card className={cn("p-4", className)}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="h-5 px-2 text-xs">
                Active
              </Badge>
            )}
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Review Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Review Status</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="needsReviewOnly"
                checked={filters.needsReviewOnly}
                onCheckedChange={(checked) => updateFilter("needsReviewOnly", !!checked)}
              />
              <Label htmlFor="needsReviewOnly" className="text-sm font-normal cursor-pointer">
                Needs Review Only
              </Label>
            </div>
          </div>

          {/* Confidence Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Confidence Range: {Math.round(filters.minConfidence * 100)}% -{" "}
              {Math.round(filters.maxConfidence * 100)}%
            </Label>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Minimum</Label>
                <Slider
                  value={[filters.minConfidence ?? 0]}
                  onValueChange={([value]) => updateFilter("minConfidence", value ?? 0)}
                  max={1}
                  min={0}
                  step={0.05}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Maximum</Label>
                <Slider
                  value={[filters.maxConfidence ?? 1]}
                  onValueChange={([value]) => updateFilter("maxConfidence", value ?? 1)}
                  max={1}
                  min={0}
                  step={0.05}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Range</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">From</Label>
                <input
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
                  className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <input
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
                  className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Search Query */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Search</Label>
            <input
              type="text"
              placeholder="Search merchants, descriptions..."
              value={filters.searchQuery || ""}
              onChange={(e) => updateFilter("searchQuery", e.target.value || undefined)}
              className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
