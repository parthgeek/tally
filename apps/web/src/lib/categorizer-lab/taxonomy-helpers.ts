import {
  getCategoriesForIndustry,
  getCategoryById,
  isFeatureEnabled,
  CategorizerFeatureFlag,
  type FeatureFlagConfig,
} from "@nexus/categorizer";

// Define CategoryNode type locally since it may not be exported
interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  type: "revenue" | "cogs" | "opex" | "liability" | "clearing" | "asset" | "equity";
  isPnL: boolean;
  includeInPrompt: boolean;
}

/**
 * Category hierarchy information for display
 */
export interface CategoryHierarchy {
  id: string;
  slug: string;
  name: string;
  parentName: string | null;
  parentSlug: string | null;
  parentId: string | null;
  type: CategoryNode["type"];
  tier: 1 | 2;
  isPnL: boolean;
}

/**
 * Display formatting options for categories
 */
export interface CategoryDisplayOptions {
  showParent?: boolean;
  showArrow?: boolean;
  format?: "full" | "compact" | "child-only" | "parent-only";
  includeType?: boolean;
}

/**
 * Get the current feature flag configuration for taxonomy
 */
function getTaxonomyConfig(): {
  config: FeatureFlagConfig;
  environment: "development" | "staging" | "production";
} {
  // In the lab environment, we'll default to development settings
  // In a real implementation, this would come from the user's environment or app config
  const environment = (process.env.NODE_ENV === "production" ? "production" : "development") as
    | "development"
    | "staging"
    | "production";

  return {
    config: {}, // Use default flags from the service
    environment,
  };
}

/**
 * Get category hierarchy information by ID
 */
export function getCategoryHierarchy(categoryId: string): CategoryHierarchy | null {
  const category = getCategoryById(categoryId);
  if (!category) {
    return null;
  }

  // Get parent category if exists
  let parentCategory: CategoryNode | undefined;
  let parentName: string | null = null;
  let parentSlug: string | null = null;
  let parentId: string | null = null;

  if (category.parentId) {
    parentCategory = getCategoryById(category.parentId);
    if (parentCategory) {
      parentName = parentCategory.name;
      parentSlug = parentCategory.slug;
      parentId = parentCategory.id;
    }
  }

  // Determine tier: if it has a parent, it's tier 2, otherwise tier 1
  const tier: 1 | 2 = category.parentId ? 2 : 1;

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    parentName,
    parentSlug,
    parentId,
    type: category.type,
    tier,
    isPnL: category.isPnL,
  };
}

/**
 * Format category for display with various options
 */
export function formatCategoryForDisplay(
  categoryId: string,
  options: CategoryDisplayOptions = {}
): string {
  const { showParent = true, showArrow = true, format = "full", includeType = false } = options;

  const hierarchy = getCategoryHierarchy(categoryId);
  if (!hierarchy) {
    return categoryId; // Fallback to ID if category not found
  }

  let displayText = "";

  switch (format) {
    case "parent-only":
      displayText = hierarchy.parentName || hierarchy.name;
      break;

    case "child-only":
      displayText = hierarchy.name;
      break;

    case "compact":
      if (hierarchy.tier === 2 && hierarchy.parentName && showParent) {
        const arrow = showArrow ? " → " : " / ";
        displayText = `${hierarchy.parentName}${arrow}${hierarchy.name}`;
      } else {
        displayText = hierarchy.name;
      }
      break;

    case "full":
    default:
      if (hierarchy.tier === 2 && hierarchy.parentName && showParent) {
        const arrow = showArrow ? " → " : " / ";
        displayText = `${hierarchy.parentName}${arrow}${hierarchy.name}`;
      } else {
        displayText = hierarchy.name;
      }
      break;
  }

  if (includeType && hierarchy.type) {
    const typeMap: Record<CategoryNode["type"], string> = {
      revenue: "Rev",
      cogs: "COGS",
      opex: "OpEx",
      liability: "Liab",
      clearing: "Clear",
      asset: "Asset",
      equity: "Equity",
    };
    const typeLabel = typeMap[hierarchy.type] || hierarchy.type;
    displayText = `[${typeLabel}] ${displayText}`;
  }

  return displayText;
}

/**
 * Get just the category display name (without parent)
 */
export function getCategoryDisplayName(categoryId: string): string {
  return formatCategoryForDisplay(categoryId, { format: "child-only" });
}

/**
 * Get parent category name
 */
export function getParentCategoryName(categoryId: string): string | null {
  const hierarchy = getCategoryHierarchy(categoryId);
  return hierarchy?.parentName || null;
}

/**
 * Get category type color for visual coding
 */
export function getCategoryTypeColor(categoryId: string): string {
  const hierarchy = getCategoryHierarchy(categoryId);
  if (!hierarchy) return "gray";

  const colorMap: Record<CategoryNode["type"], string> = {
    revenue: "green",
    cogs: "blue",
    opex: "orange",
    liability: "purple",
    clearing: "gray",
    asset: "cyan",
    equity: "indigo",
  };

  return colorMap[hierarchy.type] || "gray";
}

/**
 * Get category type badge variant for UI components
 */
export function getCategoryTypeBadgeVariant(
  categoryId: string
): "default" | "secondary" | "outline" | "destructive" {
  const hierarchy = getCategoryHierarchy(categoryId);
  if (!hierarchy) return "outline";

  const variantMap: Record<
    CategoryNode["type"],
    "default" | "secondary" | "outline" | "destructive"
  > = {
    revenue: "default",
    cogs: "secondary",
    opex: "outline",
    liability: "destructive",
    clearing: "secondary",
    asset: "secondary",
    equity: "default",
  };

  return variantMap[hierarchy.type] || "outline";
}

/**
 * Check if category is a P&L category
 */
export function isCategoryPnL(categoryId: string): boolean {
  const hierarchy = getCategoryHierarchy(categoryId);
  return hierarchy?.isPnL ?? false;
}

/**
 * Get all available categories for the current taxonomy
 */
export function getAvailableCategories(): CategoryNode[] {
  // Default lab environment to the ecommerce industry
  return getCategoriesForIndustry("ecommerce") as unknown as CategoryNode[];
}

/**
 * Get categories grouped by parent (tier 1)
 */
export function getCategoriesGroupedByParent(): Record<string, CategoryNode[]> {
  const categories = getAvailableCategories();
  const grouped: Record<string, CategoryNode[]> = {};

  // First, collect all parent categories
  const parents = categories.filter((cat) => cat.parentId === null);

  // Initialize groups
  for (const parent of parents) {
    grouped[parent.name] = [];
  }

  // Group child categories under parents
  for (const category of categories) {
    if (category.parentId) {
      const parent = categories.find((p) => p.id === category.parentId);
      if (parent && grouped[parent.name]) {
        grouped[parent.name]!.push(category);
      }
    }
  }

  return grouped;
}

/**
 * Check if two-tier taxonomy is enabled
 */
export function isTwoTierTaxonomyEnabled(): boolean {
  const { config, environment } = getTaxonomyConfig();
  return isFeatureEnabled(CategorizerFeatureFlag.TWO_TIER_TAXONOMY_ENABLED, config, environment);
}

/**
 * Get category breadcrumb for display (e.g., "Revenue > Shipping Income")
 */
export function getCategoryBreadcrumb(categoryId: string, separator: string = " > "): string {
  const hierarchy = getCategoryHierarchy(categoryId);
  if (!hierarchy) return categoryId;

  if (hierarchy.tier === 2 && hierarchy.parentName) {
    return `${hierarchy.parentName}${separator}${hierarchy.name}`;
  }

  return hierarchy.name;
}

/**
 * Validate if a category ID exists in the current taxonomy
 */
export function isValidCategoryId(categoryId: string): boolean {
  const hierarchy = getCategoryHierarchy(categoryId);
  return hierarchy !== null;
}

/**
 * Get category tier (1 or 2)
 */
export function getCategoryTier(categoryId: string): 1 | 2 | null {
  const hierarchy = getCategoryHierarchy(categoryId);
  return hierarchy?.tier || null;
}

/**
 * Filter categories by type
 */
export function getCategoriesByType(type: CategoryNode["type"]): CategoryNode[] {
  const categories = getAvailableCategories();
  return categories.filter((cat) => cat.type === type);
}
