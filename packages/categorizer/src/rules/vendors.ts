/**
 * Universal Vendor Pattern Rules
 * 
 * These rules map vendor patterns to UNIVERSAL categories with ATTRIBUTES
 * instead of vendor-specific categories.
 * 
 * Key Principles:
 * - Vendor name is an ATTRIBUTE, not a category
 * - Map to functional categories (payment_processing_fees, marketing_ads, etc.)
 * - Extract vendor/platform/processor as attributes
 */

export interface VendorPatternUniversal {
  pattern: string;
  matchType: 'exact' | 'prefix' | 'suffix' | 'contains' | 'regex';
  categorySlug: string;
  categoryName: string;
  confidence: number;
  priority: number;
  attributes?: Record<string, string>; // NEW: Extract attributes from vendor
  description?: string;
}

/**
 * Universal vendor patterns organized by category
 */
export const UNIVERSAL_VENDOR_PATTERNS: VendorPatternUniversal[] = [
  // ============================================================================
  // PAYMENT PROCESSING FEES
  // ============================================================================
  // All payment processors → payment_processing_fees category
  // Processor name goes in attributes

  {
    pattern: 'stripe',
    matchType: 'contains',
    categorySlug: 'payment_processing_fees',
    categoryName: 'Payment Processing Fees',
    confidence: 0.95,
    priority: 100,
    attributes: { processor: 'Stripe', fee_type: 'transaction' },
    description: 'Stripe payment processing fees'
  },
  {
    pattern: 'paypal',
    matchType: 'contains',
    categorySlug: 'payment_processing_fees',
    categoryName: 'Payment Processing Fees',
    confidence: 0.95,
    priority: 100,
    attributes: { processor: 'PayPal', fee_type: 'transaction' },
    description: 'PayPal merchant fees'
  },
  {
    pattern: 'square',
    matchType: 'contains',
    categorySlug: 'payment_processing_fees',
    categoryName: 'Payment Processing Fees',
    confidence: 0.93,
    priority: 95,
    attributes: { processor: 'Square', fee_type: 'transaction' },
    description: 'Square payment processing'
  },
  {
    pattern: 'shopify payments',
    matchType: 'contains',
    categorySlug: 'payment_processing_fees',
    categoryName: 'Payment Processing Fees',
    confidence: 0.95,
    priority: 100,
    attributes: { processor: 'Shopify Payments', fee_type: 'transaction' },
    description: 'Shopify Payments processing fees'
  },
  {
    pattern: 'afterpay',
    matchType: 'contains',
    categorySlug: 'payment_processing_fees',
    categoryName: 'Payment Processing Fees',
    confidence: 0.95,
    priority: 100,
    attributes: { processor: 'Afterpay', fee_type: 'transaction' },
    description: 'Afterpay BNPL fees'
  },
  {
    pattern: 'affirm',
    matchType: 'contains',
    categorySlug: 'payment_processing_fees',
    categoryName: 'Payment Processing Fees',
    confidence: 0.95,
    priority: 100,
    attributes: { processor: 'Affirm', fee_type: 'transaction' },
    description: 'Affirm BNPL fees'
  },
  {
    pattern: 'klarna',
    matchType: 'contains',
    categorySlug: 'payment_processing_fees',
    categoryName: 'Payment Processing Fees',
    confidence: 0.95,
    priority: 100,
    attributes: { processor: 'Klarna', fee_type: 'transaction' },
    description: 'Klarna BNPL fees'
  },

  // ============================================================================
  // MARKETING & ADVERTISING
  // ============================================================================
  // All ad platforms → marketing_ads category
  // Platform name goes in attributes

  {
    pattern: 'facebook ads',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'Meta', campaign_type: 'paid_social' },
    description: 'Facebook advertising'
  },
  {
    pattern: 'meta ads',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'Meta', campaign_type: 'paid_social' },
    description: 'Meta (Facebook/Instagram) advertising'
  },
  {
    pattern: 'instagram ads',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'Meta', campaign_type: 'paid_social' },
    description: 'Instagram advertising'
  },
  {
    pattern: 'google ads',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'Google', campaign_type: 'paid_search' },
    description: 'Google Ads / AdWords'
  },
  {
    pattern: 'google adwords',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'Google', campaign_type: 'paid_search' },
    description: 'Google AdWords'
  },
  {
    pattern: 'tiktok ads',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'TikTok', campaign_type: 'paid_social' },
    description: 'TikTok advertising'
  },
  {
    pattern: 'linkedin ads',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'LinkedIn', campaign_type: 'paid_social' },
    description: 'LinkedIn advertising'
  },
  {
    pattern: 'pinterest ads',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'Pinterest', campaign_type: 'paid_social' },
    description: 'Pinterest advertising'
  },
  {
    pattern: 'snapchat ads',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.98,
    priority: 110,
    attributes: { platform: 'Snapchat', campaign_type: 'paid_social' },
    description: 'Snapchat advertising'
  },
  {
    pattern: 'klaviyo',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.90,
    priority: 85,
    attributes: { platform: 'Klaviyo', campaign_type: 'email' },
    description: 'Klaviyo email marketing'
  },
  {
    pattern: 'mailchimp',
    matchType: 'contains',
    categorySlug: 'marketing_ads',
    categoryName: 'Marketing & Advertising',
    confidence: 0.90,
    priority: 85,
    attributes: { platform: 'Mailchimp', campaign_type: 'email' },
    description: 'Mailchimp email marketing'
  },

  // ============================================================================
  // SOFTWARE & TECHNOLOGY
  // ============================================================================
  // All SaaS subscriptions → software_subscriptions category
  // Vendor name goes in attributes

  {
    pattern: 'adobe',
    matchType: 'contains',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.92,
    priority: 90,
    attributes: { vendor: 'Adobe', category: 'design' },
    description: 'Adobe software subscriptions'
  },
  {
    pattern: 'microsoft 365',
    matchType: 'contains',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'Microsoft', category: 'productivity' },
    description: 'Microsoft 365 subscription'
  },
  {
    pattern: 'microsoft office',
    matchType: 'contains',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'Microsoft', category: 'productivity' },
    description: 'Microsoft Office subscription'
  },
  {
    pattern: 'google workspace',
    matchType: 'contains',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'Google', category: 'productivity' },
    description: 'Google Workspace subscription'
  },
  {
    pattern: 'slack',
    matchType: 'exact',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 90,
    attributes: { vendor: 'Slack', category: 'communication' },
    description: 'Slack subscription'
  },
  {
    pattern: 'zoom',
    matchType: 'exact',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.92,
    priority: 85,
    attributes: { vendor: 'Zoom', category: 'communication' },
    description: 'Zoom subscription'
  },
  {
    pattern: 'asana',
    matchType: 'exact',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 90,
    attributes: { vendor: 'Asana', category: 'productivity' },
    description: 'Asana subscription'
  },
  {
    pattern: 'canva',
    matchType: 'exact',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'Canva', category: 'design' },
    description: 'Canva subscription'
  },
  {
    pattern: 'figma',
    matchType: 'exact',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'Figma', category: 'design' },
    description: 'Figma subscription'
  },
  {
    pattern: 'quickbooks',
    matchType: 'contains',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'QuickBooks', category: 'accounting' },
    description: 'QuickBooks accounting software'
  },
  {
    pattern: 'xero',
    matchType: 'exact',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'Xero', category: 'accounting' },
    description: 'Xero accounting software'
  },
  {
    pattern: 'salesforce',
    matchType: 'contains',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'Salesforce', category: 'crm' },
    description: 'Salesforce CRM'
  },
  {
    pattern: 'hubspot',
    matchType: 'contains',
    categorySlug: 'software_subscriptions',
    categoryName: 'Software & Technology',
    confidence: 0.95,
    priority: 95,
    attributes: { vendor: 'HubSpot', category: 'crm' },
    description: 'HubSpot CRM and marketing'
  },

  // ============================================================================
  // PLATFORM FEES (E-commerce specific)
  // ============================================================================
  
  {
    pattern: 'shopify subscription',
    matchType: 'contains',
    categorySlug: 'platform_fees',
    categoryName: 'Platform Fees',
    confidence: 0.95,
    priority: 100,
    attributes: { platform: 'Shopify', fee_type: 'monthly' },
    description: 'Shopify monthly subscription'
  },
  {
    pattern: 'amazon seller',
    matchType: 'contains',
    categorySlug: 'platform_fees',
    categoryName: 'Platform Fees',
    confidence: 0.90,
    priority: 90,
    attributes: { platform: 'Amazon', fee_type: 'monthly' },
    description: 'Amazon seller fees'
  },
  {
    pattern: 'etsy',
    matchType: 'contains',
    categorySlug: 'platform_fees',
    categoryName: 'Platform Fees',
    confidence: 0.90,
    priority: 90,
    attributes: { platform: 'Etsy', fee_type: 'transaction' },
    description: 'Etsy marketplace fees'
  },

  // ============================================================================
  // FULFILLMENT & LOGISTICS (E-commerce specific)
  // ============================================================================

  {
    pattern: 'shipbob',
    matchType: 'contains',
    categorySlug: 'fulfillment_logistics',
    categoryName: 'Fulfillment & Logistics',
    confidence: 0.95,
    priority: 100,
    attributes: { provider: 'ShipBob', service_type: 'pick_pack' },
    description: 'ShipBob 3PL services'
  },
  {
    pattern: 'shipmonk',
    matchType: 'contains',
    categorySlug: 'fulfillment_logistics',
    categoryName: 'Fulfillment & Logistics',
    confidence: 0.95,
    priority: 100,
    attributes: { provider: 'ShipMonk', service_type: 'pick_pack' },
    description: 'ShipMonk 3PL services'
  },
  {
    pattern: 'deliverr',
    matchType: 'contains',
    categorySlug: 'fulfillment_logistics',
    categoryName: 'Fulfillment & Logistics',
    confidence: 0.95,
    priority: 100,
    attributes: { provider: 'Deliverr', service_type: 'pick_pack' },
    description: 'Deliverr fulfillment'
  },
  {
    pattern: 'amazon fba',
    matchType: 'contains',
    categorySlug: 'fulfillment_logistics',
    categoryName: 'Fulfillment & Logistics',
    confidence: 0.95,
    priority: 100,
    attributes: { provider: 'Amazon FBA', service_type: 'pick_pack' },
    description: 'Amazon FBA fulfillment fees'
  },

  // ============================================================================
  // FREIGHT & SHIPPING (Universal)
  // ============================================================================

  {
    pattern: 'usps',
    matchType: 'contains',
    categorySlug: 'freight_shipping',
    categoryName: 'Freight & Shipping',
    confidence: 0.90,
    priority: 85,
    attributes: { carrier: 'USPS', direction: 'outbound' },
    description: 'USPS shipping'
  },
  {
    pattern: 'fedex',
    matchType: 'contains',
    categorySlug: 'freight_shipping',
    categoryName: 'Freight & Shipping',
    confidence: 0.92,
    priority: 90,
    attributes: { carrier: 'FedEx', direction: 'outbound' },
    description: 'FedEx shipping'
  },
  {
    pattern: 'ups',
    matchType: 'exact',
    categorySlug: 'freight_shipping',
    categoryName: 'Freight & Shipping',
    confidence: 0.92,
    priority: 90,
    attributes: { carrier: 'UPS', direction: 'outbound' },
    description: 'UPS shipping'
  },
  {
    pattern: 'dhl',
    matchType: 'exact',
    categorySlug: 'freight_shipping',
    categoryName: 'Freight & Shipping',
    confidence: 0.92,
    priority: 90,
    attributes: { carrier: 'DHL', direction: 'outbound' },
    description: 'DHL shipping'
  },

  // ============================================================================
  // PROFESSIONAL SERVICES
  // ============================================================================

  {
    pattern: 'cpa',
    matchType: 'contains',
    categorySlug: 'professional_services',
    categoryName: 'Professional Services',
    confidence: 0.85,
    priority: 80,
    attributes: { service_type: 'accounting' },
    description: 'CPA / accounting services'
  },
  {
    pattern: 'accountant',
    matchType: 'contains',
    categorySlug: 'professional_services',
    categoryName: 'Professional Services',
    confidence: 0.85,
    priority: 80,
    attributes: { service_type: 'accounting' },
    description: 'Accountant fees'
  },
  {
    pattern: 'legal',
    matchType: 'contains',
    categorySlug: 'professional_services',
    categoryName: 'Professional Services',
    confidence: 0.82,
    priority: 75,
    attributes: { service_type: 'legal' },
    description: 'Legal services'
  },
  {
    pattern: 'attorney',
    matchType: 'contains',
    categorySlug: 'professional_services',
    categoryName: 'Professional Services',
    confidence: 0.82,
    priority: 75,
    attributes: { service_type: 'legal' },
    description: 'Attorney fees'
  },
  {
    pattern: 'lawyer',
    matchType: 'contains',
    categorySlug: 'professional_services',
    categoryName: 'Professional Services',
    confidence: 0.82,
    priority: 75,
    attributes: { service_type: 'legal' },
    description: 'Lawyer fees'
  },
  {
    pattern: 'consultant',
    matchType: 'contains',
    categorySlug: 'professional_services',
    categoryName: 'Professional Services',
    confidence: 0.80,
    priority: 70,
    attributes: { service_type: 'consulting' },
    description: 'Consulting services'
  },

  // ============================================================================
  // INSURANCE
  // ============================================================================

  {
    pattern: 'insurance',
    matchType: 'contains',
    categorySlug: 'insurance',
    categoryName: 'Insurance',
    confidence: 0.90,
    priority: 85,
    attributes: {},
    description: 'Business insurance'
  },

  // ============================================================================
  // RENT & UTILITIES
  // ============================================================================

  {
    pattern: 'rent',
    matchType: 'contains',
    categorySlug: 'rent_utilities',
    categoryName: 'Rent & Utilities',
    confidence: 0.85,
    priority: 80,
    attributes: {},
    description: 'Rent payment'
  },
  {
    pattern: 'electric',
    matchType: 'contains',
    categorySlug: 'rent_utilities',
    categoryName: 'Rent & Utilities',
    confidence: 0.85,
    priority: 80,
    attributes: { utility_type: 'electric' },
    description: 'Electric utility'
  },
  {
    pattern: 'utilities',
    matchType: 'contains',
    categorySlug: 'rent_utilities',
    categoryName: 'Rent & Utilities',
    confidence: 0.85,
    priority: 80,
    attributes: {},
    description: 'Utility bills'
  },

  // ============================================================================
  // TELECOMMUNICATIONS & INTERNET SERVICE PROVIDERS
  // ============================================================================
  // ISPs and telecom providers → telecommunications category
  // Provider name goes in attributes

  {
    pattern: 'comcast',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'Comcast', service_type: 'internet' },
    description: 'Comcast internet and cable service'
  },
  {
    pattern: 'verizon',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'Verizon', service_type: 'telecom' },
    description: 'Verizon telecommunications'
  },
  {
    pattern: 'at&t',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'AT&T', service_type: 'telecom' },
    description: 'AT&T telecommunications'
  },
  {
    pattern: 'att ',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'AT&T', service_type: 'telecom' },
    description: 'AT&T telecommunications (alternate format)'
  },
  {
    pattern: 'spectrum',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'Spectrum', service_type: 'internet' },
    description: 'Spectrum internet and cable service'
  },
  {
    pattern: 'cox communications',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'Cox', service_type: 'internet' },
    description: 'Cox internet and cable service'
  },
  {
    pattern: 'cox cable',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'Cox', service_type: 'internet' },
    description: 'Cox cable service'
  },
  {
    pattern: 'centurylink',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'CenturyLink', service_type: 'internet' },
    description: 'CenturyLink internet service'
  },
  {
    pattern: 'frontier communications',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'Frontier', service_type: 'internet' },
    description: 'Frontier internet service'
  },
  {
    pattern: 'optimum',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'Optimum', service_type: 'internet' },
    description: 'Optimum internet and cable service'
  },
  {
    pattern: 'xfinity',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'Comcast Xfinity', service_type: 'internet' },
    description: 'Comcast Xfinity internet and cable service'
  },
  {
    pattern: 't-mobile',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.92,
    priority: 90,
    attributes: { provider: 'T-Mobile', service_type: 'mobile' },
    description: 'T-Mobile wireless service'
  },
  {
    pattern: 'sprint',
    matchType: 'contains',
    categorySlug: 'telecommunications',
    categoryName: 'Telecommunications',
    confidence: 0.90,
    priority: 85,
    attributes: { provider: 'Sprint', service_type: 'mobile' },
    description: 'Sprint wireless service'
  },
];

/**
 * Match vendor pattern against transaction
 */
export function matchVendorPattern(
  merchantName: string | null,
  description: string,
  pattern: VendorPatternUniversal
): boolean {
  const searchText = `${merchantName || ''} ${description}`.toLowerCase();
  const patternLower = pattern.pattern.toLowerCase();

  switch (pattern.matchType) {
    case 'exact':
      return searchText.trim() === patternLower;
    case 'prefix':
      return searchText.startsWith(patternLower);
    case 'suffix':
      return searchText.endsWith(patternLower);
    case 'contains':
      return searchText.includes(patternLower);
    case 'regex':
      try {
        const regex = new RegExp(pattern.pattern, 'i');
        return regex.test(searchText);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Find best matching vendor pattern
 */
export function findBestVendorMatch(
  merchantName: string | null,
  description: string
): VendorPatternUniversal | null {
  // Find all matching patterns
  const matches = UNIVERSAL_VENDOR_PATTERNS.filter(pattern =>
    matchVendorPattern(merchantName, description, pattern)
  );

  if (matches.length === 0) {
    return null;
  }

  // Sort by priority (descending) and return highest
  matches.sort((a, b) => b.priority - a.priority);
  return matches[0] || null;
}

