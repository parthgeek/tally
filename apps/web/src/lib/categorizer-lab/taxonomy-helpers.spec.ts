import { describe, expect, test, beforeEach, vi } from "vitest";
import {
  getCategoryHierarchy,
  formatCategoryForDisplay,
  getCategoryDisplayName,
  getParentCategoryName,
  getCategoryTypeColor,
  getCategoryTypeBadgeVariant,
  isCategoryPnL,
  getCategoryTier,
  isValidCategoryId,
  getCategoryBreadcrumb,
  isTwoTierTaxonomyEnabled,
  getCategoriesGroupedByParent,
} from "./taxonomy-helpers";

// Mock the categorizer package functions
vi.mock("@nexus/categorizer", () => ({
  getActiveTaxonomy: vi.fn(),
  getCategoryById: vi.fn(),
  isFeatureEnabled: vi.fn(),
  CategorizerFeatureFlag: {
    TWO_TIER_TAXONOMY_ENABLED: "categorizer_two_tier_taxonomy_enabled",
  },
}));

const { getActiveTaxonomy, getCategoryById, isFeatureEnabled } = await import("@nexus/categorizer");

// Mock categories for testing
const mockCategories = [
  // Parent categories (Tier 1)
  {
    id: "parent-opex-id",
    slug: "operating_expenses",
    name: "Operating Expenses",
    parentId: null,
    type: "opex" as const,
    isPnL: true,
    includeInPrompt: false,
  },
  {
    id: "parent-revenue-id",
    slug: "revenue",
    name: "Revenue",
    parentId: null,
    type: "revenue" as const,
    isPnL: true,
    includeInPrompt: false,
  },
  // Child categories (Tier 2)
  {
    id: "child-ga-id",
    slug: "general_administrative",
    name: "General & Administrative",
    parentId: "parent-opex-id",
    type: "opex" as const,
    isPnL: true,
    includeInPrompt: true,
  },
  {
    id: "child-shipping-id",
    slug: "shipping_income",
    name: "Shipping Income",
    parentId: "parent-revenue-id",
    type: "revenue" as const,
    isPnL: true,
    includeInPrompt: true,
  },
  // Non-P&L category
  {
    id: "clearing-id",
    slug: "payouts_clearing",
    name: "Payouts Clearing",
    parentId: "parent-clearing-id",
    type: "clearing" as const,
    isPnL: false,
    includeInPrompt: false,
  },
];

describe("taxonomy-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(getActiveTaxonomy).mockReturnValue(mockCategories);
    vi.mocked(isFeatureEnabled).mockReturnValue(true); // Two-tier enabled by default

    // Setup getCategoryById mock
    vi.mocked(getCategoryById).mockImplementation((id) => {
      return mockCategories.find((cat) => cat.id === id);
    });
  });

  describe("getCategoryHierarchy", () => {
    test("returns hierarchy for valid tier 2 category", () => {
      const hierarchy = getCategoryHierarchy("child-ga-id");

      expect(hierarchy).toEqual({
        id: "child-ga-id",
        slug: "general_administrative",
        name: "General & Administrative",
        parentName: "Operating Expenses",
        parentSlug: "operating_expenses",
        parentId: "parent-opex-id",
        type: "opex",
        tier: 2,
        isPnL: true,
      });
    });

    test("returns hierarchy for tier 1 category", () => {
      const hierarchy = getCategoryHierarchy("parent-opex-id");

      expect(hierarchy).toEqual({
        id: "parent-opex-id",
        slug: "operating_expenses",
        name: "Operating Expenses",
        parentName: null,
        parentSlug: null,
        parentId: null,
        type: "opex",
        tier: 1,
        isPnL: true,
      });
    });

    test("returns null for invalid category ID", () => {
      const hierarchy = getCategoryHierarchy("invalid-id");
      expect(hierarchy).toBeNull();
    });
  });

  describe("formatCategoryForDisplay", () => {
    test("formats tier 2 category with compact format", () => {
      const display = formatCategoryForDisplay("child-ga-id", { format: "compact" });
      expect(display).toBe("Operating Expenses → General & Administrative");
    });

    test("formats tier 1 category", () => {
      const display = formatCategoryForDisplay("parent-opex-id", { format: "compact" });
      expect(display).toBe("Operating Expenses");
    });

    test("formats with child-only format", () => {
      const display = formatCategoryForDisplay("child-ga-id", { format: "child-only" });
      expect(display).toBe("General & Administrative");
    });

    test("formats with parent-only format", () => {
      const display = formatCategoryForDisplay("child-ga-id", { format: "parent-only" });
      expect(display).toBe("Operating Expenses");
    });

    test("includes type when requested", () => {
      const display = formatCategoryForDisplay("child-ga-id", {
        format: "compact",
        includeType: true,
      });
      expect(display).toBe("[OpEx] Operating Expenses → General & Administrative");
    });

    test("falls back to ID for invalid category", () => {
      const display = formatCategoryForDisplay("invalid-id");
      expect(display).toBe("invalid-id");
    });
  });

  describe("getCategoryDisplayName", () => {
    test("returns child category name only", () => {
      const name = getCategoryDisplayName("child-ga-id");
      expect(name).toBe("General & Administrative");
    });
  });

  describe("getParentCategoryName", () => {
    test("returns parent name for tier 2 category", () => {
      const parentName = getParentCategoryName("child-ga-id");
      expect(parentName).toBe("Operating Expenses");
    });

    test("returns null for tier 1 category", () => {
      const parentName = getParentCategoryName("parent-opex-id");
      expect(parentName).toBeNull();
    });
  });

  describe("getCategoryTypeColor", () => {
    test("returns correct color for opex category", () => {
      const color = getCategoryTypeColor("child-ga-id");
      expect(color).toBe("orange");
    });

    test("returns correct color for revenue category", () => {
      const color = getCategoryTypeColor("child-shipping-id");
      expect(color).toBe("green");
    });

    test("returns gray for invalid category", () => {
      const color = getCategoryTypeColor("invalid-id");
      expect(color).toBe("gray");
    });
  });

  describe("getCategoryTypeBadgeVariant", () => {
    test("returns correct variant for revenue category", () => {
      const variant = getCategoryTypeBadgeVariant("child-shipping-id");
      expect(variant).toBe("default");
    });

    test("returns correct variant for opex category", () => {
      const variant = getCategoryTypeBadgeVariant("child-ga-id");
      expect(variant).toBe("outline");
    });

    test("returns outline for invalid category", () => {
      const variant = getCategoryTypeBadgeVariant("invalid-id");
      expect(variant).toBe("outline");
    });
  });

  describe("isCategoryPnL", () => {
    test("returns true for P&L category", () => {
      const isPnL = isCategoryPnL("child-ga-id");
      expect(isPnL).toBe(true);
    });

    test("returns false for non-P&L category", () => {
      const isPnL = isCategoryPnL("clearing-id");
      expect(isPnL).toBe(false);
    });

    test("returns false for invalid category", () => {
      const isPnL = isCategoryPnL("invalid-id");
      expect(isPnL).toBe(false);
    });
  });

  describe("getCategoryTier", () => {
    test("returns 1 for tier 1 category", () => {
      const tier = getCategoryTier("parent-opex-id");
      expect(tier).toBe(1);
    });

    test("returns 2 for tier 2 category", () => {
      const tier = getCategoryTier("child-ga-id");
      expect(tier).toBe(2);
    });

    test("returns null for invalid category", () => {
      const tier = getCategoryTier("invalid-id");
      expect(tier).toBeNull();
    });
  });

  describe("isValidCategoryId", () => {
    test("returns true for valid category ID", () => {
      const isValid = isValidCategoryId("child-ga-id");
      expect(isValid).toBe(true);
    });

    test("returns false for invalid category ID", () => {
      const isValid = isValidCategoryId("invalid-id");
      expect(isValid).toBe(false);
    });
  });

  describe("getCategoryBreadcrumb", () => {
    test("returns breadcrumb for tier 2 category", () => {
      const breadcrumb = getCategoryBreadcrumb("child-ga-id");
      expect(breadcrumb).toBe("Operating Expenses > General & Administrative");
    });

    test("returns name only for tier 1 category", () => {
      const breadcrumb = getCategoryBreadcrumb("parent-opex-id");
      expect(breadcrumb).toBe("Operating Expenses");
    });

    test("uses custom separator", () => {
      const breadcrumb = getCategoryBreadcrumb("child-ga-id", " / ");
      expect(breadcrumb).toBe("Operating Expenses / General & Administrative");
    });

    test("returns ID for invalid category", () => {
      const breadcrumb = getCategoryBreadcrumb("invalid-id");
      expect(breadcrumb).toBe("invalid-id");
    });
  });

  describe("isTwoTierTaxonomyEnabled", () => {
    test("returns true when feature flag is enabled", () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(true);
      const isEnabled = isTwoTierTaxonomyEnabled();
      expect(isEnabled).toBe(true);
    });

    test("returns false when feature flag is disabled", () => {
      vi.mocked(isFeatureEnabled).mockReturnValue(false);
      const isEnabled = isTwoTierTaxonomyEnabled();
      expect(isEnabled).toBe(false);
    });
  });

  describe("getCategoriesGroupedByParent", () => {
    test("groups categories by parent correctly", () => {
      const grouped = getCategoriesGroupedByParent();

      expect(grouped).toHaveProperty("Operating Expenses");
      expect(grouped).toHaveProperty("Revenue");
      expect(grouped["Operating Expenses"]).toEqual([
        expect.objectContaining({
          id: "child-ga-id",
          name: "General & Administrative",
        }),
      ]);
      expect(grouped["Revenue"]).toEqual([
        expect.objectContaining({
          id: "child-shipping-id",
          name: "Shipping Income",
        }),
      ]);
    });
  });

  describe("edge cases", () => {
    test("handles category with missing parent", () => {
      // Mock a category with parentId that doesn't exist
      vi.mocked(getCategoryById).mockImplementation((id) => {
        if (id === "orphan-id") {
          return {
            id: "orphan-id",
            slug: "orphan",
            name: "Orphan Category",
            parentId: "non-existent-parent",
            type: "opex" as const,
            isPnL: true,
            includeInPrompt: true,
          };
        }
        return mockCategories.find((cat) => cat.id === id);
      });

      const hierarchy = getCategoryHierarchy("orphan-id");
      expect(hierarchy).toEqual({
        id: "orphan-id",
        slug: "orphan",
        name: "Orphan Category",
        parentName: null,
        parentSlug: null,
        parentId: "non-existent-parent",
        type: "opex",
        tier: 2,
        isPnL: true,
      });
    });

    test("handles empty taxonomy", () => {
      vi.mocked(getActiveTaxonomy).mockReturnValue([]);

      const grouped = getCategoriesGroupedByParent();
      expect(grouped).toEqual({});
    });
  });
});
