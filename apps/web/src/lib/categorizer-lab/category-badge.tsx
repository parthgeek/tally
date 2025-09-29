'use client';

import { Badge } from '@/components/ui/badge';
import { ArrowRightIcon, TreePineIcon } from 'lucide-react';
import {
  formatCategoryForDisplay,
  getCategoryHierarchy,
  getCategoryTypeBadgeVariant,
  getCategoryTier,
  isValidCategoryId
} from './taxonomy-helpers';

interface CategoryBadgeProps {
  categoryId: string;
  format?: 'full' | 'compact' | 'child-only' | 'parent-only';
  showTier?: boolean;
  showWarning?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Enhanced category badge component with visual hierarchy indicators
 */
export function CategoryBadge({
  categoryId,
  format = 'compact',
  showTier = true,
  showWarning = true,
  size = 'sm',
  className = ''
}: CategoryBadgeProps) {
  const hierarchy = getCategoryHierarchy(categoryId);
  const isValid = isValidCategoryId(categoryId);

  if (!isValid && showWarning) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <Badge variant="outline" className={`text-${size}`}>
          {categoryId}
        </Badge>
        <span className={`text-${size} text-amber-600`} title={`Invalid category ID: ${categoryId}`}>
          ⚠️
        </span>
      </div>
    );
  }

  if (!hierarchy) {
    return (
      <Badge variant="outline" className={`text-${size} ${className}`}>
        {categoryId}
      </Badge>
    );
  }

  const displayText = formatCategoryForDisplay(categoryId, { format });
  const variant = getCategoryTypeBadgeVariant(categoryId);
  const tier = getCategoryTier(categoryId);

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {/* Main category badge */}
      <Badge
        variant={variant}
        className={`text-${size} relative`}
        title={`Tier ${tier} | ID: ${categoryId} | Type: ${hierarchy.type}`}
      >
        {/* Tier indicator */}
        {showTier && tier && (
          <span className="inline-flex items-center gap-1">
            {tier === 1 ? (
              <TreePineIcon className="w-2 h-2" />
            ) : (
              <ArrowRightIcon className="w-2 h-2" />
            )}
            {displayText}
          </span>
        )}
        {!showTier && displayText}
      </Badge>

      {/* P&L indicator for tier 1 categories */}
      {hierarchy.tier === 1 && hierarchy.isPnL && (
        <Badge variant="outline" className="text-xs">
          P&L
        </Badge>
      )}
    </div>
  );
}

/**
 * Category hierarchy display component for showing parent-child relationships
 */
interface CategoryHierarchyProps {
  categoryId: string;
  showFullPath?: boolean;
  className?: string;
}

export function CategoryHierarchy({
  categoryId,
  showFullPath = true,
  className = ''
}: CategoryHierarchyProps) {
  const hierarchy = getCategoryHierarchy(categoryId);

  if (!hierarchy) {
    return (
      <div className={className}>
        <CategoryBadge categoryId={categoryId} showWarning />
      </div>
    );
  }

  if (hierarchy.tier === 1 || !showFullPath) {
    return (
      <div className={className}>
        <CategoryBadge categoryId={categoryId} format="child-only" />
      </div>
    );
  }

  // Tier 2 category with parent
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Parent category */}
      {hierarchy.parentId && (
        <>
          <CategoryBadge
            categoryId={hierarchy.parentId}
            format="child-only"
            showTier={false}
            size="sm"
          />
          <ArrowRightIcon className="w-3 h-3 text-gray-400" />
        </>
      )}

      {/* Child category */}
      <CategoryBadge
        categoryId={categoryId}
        format="child-only"
        showTier={false}
      />
    </div>
  );
}

/**
 * Type-specific color classes for different category types
 */
export const categoryTypeColors = {
  revenue: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-800'
  },
  cogs: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-800'
  },
  opex: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-800'
  },
  liability: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    badge: 'bg-purple-100 text-purple-800'
  },
  clearing: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-800',
    badge: 'bg-gray-100 text-gray-800'
  }
} as const;

/**
 * Get color classes for a category type
 */
export function getCategoryTypeColors(categoryId: string) {
  const hierarchy = getCategoryHierarchy(categoryId);
  if (!hierarchy) return categoryTypeColors.clearing;

  const colorKey = hierarchy.type as keyof typeof categoryTypeColors;
  return categoryTypeColors[colorKey] || categoryTypeColors.clearing;
}