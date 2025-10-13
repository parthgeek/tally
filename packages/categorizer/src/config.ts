import type { Industry } from './taxonomy.js';
export type { Industry };

export interface CategorizationConfig {
  industry: Industry;
  useLLM: boolean;
  autoApplyThreshold: number;
  hybridThreshold: number;
  useGuardrails: boolean;
}

export interface CategoryConfig {
  industry: Industry;
  useLLM: boolean;
  autoApplyThreshold: number;
  hybridThreshold: number;
}

/**
 * Default configuration for e-commerce categorization
 */
export const DEFAULT_ECOMMERCE_CONFIG: CategorizationConfig = {
  industry: 'ecommerce',
  useLLM: true,
  autoApplyThreshold: 0.95,
  hybridThreshold: 0.95,
  useGuardrails: true,
};

/**
 * Default configuration for all industries
 */
export const DEFAULT_CONFIG: CategorizationConfig = {
  industry: 'all',
  useLLM: true,
  autoApplyThreshold: 0.95,
  hybridThreshold: 0.95,
  useGuardrails: true,
};

/**
 * Gets the industry for an organization from the database
 */
export async function getIndustryForOrg(
  db: any,
  orgId: string
): Promise<Industry> {
  try {
    const { data: org, error } = await db
      .from('orgs')
      .select('industry')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      console.warn(`Could not fetch industry for org ${orgId}, defaulting to ecommerce`);
      return 'ecommerce';
    }

    // Map database industry values to our Industry type
    switch (org.industry?.toLowerCase()) {
      case 'ecommerce':
      case 'e-commerce':
      case 'ecom':
      case 'retail':
      case 'online retail':
        return 'ecommerce';
      case 'saas':
      case 'software':
        return 'saas';
      case 'restaurant':
      case 'food service':
      case 'hospitality':
        return 'restaurant';
      case 'professional services':
      case 'professional_services':
      case 'consulting':
        return 'professional_services';
      default:
        // Default to ecommerce for unknown industries
        console.warn(`Unknown industry '${org.industry}' for org ${orgId}, defaulting to ecommerce`);
        return 'ecommerce';
    }
  } catch (error) {
    console.error(`Error fetching industry for org ${orgId}:`, error);
    return 'ecommerce';
  }
}

/**
 * Determines if LLM should be used for the given industry
 */
export function shouldUseLLM(industry: Industry): boolean {
  switch (industry) {
    case 'ecommerce':
      return true;
    default:
      return true;
  }
}

/**
 * Gets the complete categorization configuration for an organization
 */
export async function getCategorizationConfig(
  db: any,
  orgId: string
): Promise<CategorizationConfig> {
  const industry = await getIndustryForOrg(db, orgId);

  switch (industry) {
    case 'ecommerce':
      return DEFAULT_ECOMMERCE_CONFIG;
    default:
      return DEFAULT_ECOMMERCE_CONFIG;
  }
}

/**
 * Gets the auto-apply threshold for an industry
 */
export function getAutoApplyThreshold(industry: Industry): number {
  switch (industry) {
    case 'ecommerce':
      return 0.95;
    default:
      return 0.95;
  }
}

/**
 * Gets the hybrid threshold (Pass-1 to Pass-2 cutoff) for an industry
 */
export function getHybridThreshold(industry: Industry): number {
  switch (industry) {
    case 'ecommerce':
      return 0.95;
    default:
      return 0.95;
  }
}