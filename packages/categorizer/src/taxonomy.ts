/**
 * Universal Multi-Vertical Taxonomy
 * 
 * This taxonomy is designed to work across multiple industries (e-commerce, SaaS, restaurants, etc.)
 * using universal categories + flexible attributes instead of vendor-specific categories.
 * 
 * Key Principles:
 * - Vendor names are attributes, not categories (e.g., "Stripe" is an attribute of "Payment Processing")
 * - 18-22 core categories instead of 38+ vendor-specific categories
 * - Industry-specific categories are flagged and filtered appropriately
 * - Attributes provide flexibility without category explosion
 */

export type Industry = 'all' | 'ecommerce' | 'saas' | 'restaurant' | 'professional_services';

export interface AttributeSchema {
  [key: string]: {
    type: 'string' | 'enum' | 'number' | 'boolean';
    values?: string[];
    required?: boolean;
    description?: string;
  };
}

export interface UniversalCategory {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  type: 'revenue' | 'cogs' | 'opex' | 'liability' | 'clearing' | 'asset' | 'equity';
  tier: 1 | 2 | 3;
  isPnL: boolean;
  includeInPrompt: boolean;
  industries: Industry[];
  isUniversal: boolean;
  attributeSchema: AttributeSchema;
  displayOrder: number;
  description?: string;
  examples?: string[];
}

/**
 * Universal Category IDs (consistent UUIDs across all environments)
 */
export const UNIVERSAL_CATEGORY_IDS = {
  // Tier 1 Parents
  revenue: '550e8400-e29b-41d4-a716-446655440100',
  cogs: '550e8400-e29b-41d4-a716-446655440200',
  operating_expenses: '550e8400-e29b-41d4-a716-446655440300',
  taxes_liabilities: '550e8400-e29b-41d4-a716-446655440400',
  clearing: '550e8400-e29b-41d4-a716-446655440500',
  
  // Revenue (Universal)
  product_sales: '550e8400-e29b-41d4-a716-446655440101',
  service_revenue: '550e8400-e29b-41d4-a716-446655440102',
  shipping_income: '550e8400-e29b-41d4-a716-446655440103',
  refunds_contra: '550e8400-e29b-41d4-a716-446655440105',
  discounts_contra: '550e8400-e29b-41d4-a716-446655440106',
  
  // COGS (Universal)
  materials_supplies: '550e8400-e29b-41d4-a716-446655440201',
  direct_labor: '550e8400-e29b-41d4-a716-446655440202',
  packaging: '550e8400-e29b-41d4-a716-446655440206',
  freight_shipping: '550e8400-e29b-41d4-a716-446655440207',
  
  // Operating Expenses (Universal)
  marketing_ads: '550e8400-e29b-41d4-a716-446655440303',
  software_subscriptions: '550e8400-e29b-41d4-a716-446655440304',
  payment_processing_fees: '550e8400-e29b-41d4-a716-446655440301',
  labor: '550e8400-e29b-41d4-a716-446655440305',
  professional_services: '550e8400-e29b-41d4-a716-446655440352',
  rent_utilities: '550e8400-e29b-41d4-a716-446655440353',
  insurance: '550e8400-e29b-41d4-a716-446655440354',
  office_supplies: '550e8400-e29b-41d4-a716-446655440356',
  travel_meals: '550e8400-e29b-41d4-a716-446655440357',
  bank_fees: '550e8400-e29b-41d4-a716-446655440358',
  telecommunications: '550e8400-e29b-41d4-a716-446655440361',
  repairs_maintenance: '550e8400-e29b-41d4-a716-446655440362',
  vehicle_transportation: '550e8400-e29b-41d4-a716-446655440363',
  legal_compliance: '550e8400-e29b-41d4-a716-446655440366',
  miscellaneous: '550e8400-e29b-41d4-a716-446655440308',
  
  // Industry-Specific
  fulfillment_logistics: '550e8400-e29b-41d4-a716-446655440321', // E-commerce
  platform_fees: '550e8400-e29b-41d4-a716-446655440322', // E-commerce, Marketplaces
  hosting_infrastructure: '550e8400-e29b-41d4-a716-446655440323', // SaaS
  
  // Non-P&L
  sales_tax_payable: '550e8400-e29b-41d4-a716-446655440401',
  payouts_clearing: '550e8400-e29b-41d4-a716-446655440503',
} as const;

/**
 * Universal Taxonomy - Complete Category Tree
 */
export const UNIVERSAL_TAXONOMY: UniversalCategory[] = [
  // ============================================================================
  // TIER 1: PARENT CATEGORIES
  // ============================================================================
  {
    id: UNIVERSAL_CATEGORY_IDS.revenue,
    slug: 'revenue',
    name: 'Revenue',
    parentId: null,
    type: 'revenue',
    tier: 1,
    isPnL: true,
    includeInPrompt: false,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 1,
    attributeSchema: {},
    description: 'All income and revenue sources'
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.cogs,
    slug: 'cogs',
    name: 'Cost of Goods Sold',
    parentId: null,
    type: 'cogs',
    tier: 1,
    isPnL: true,
    includeInPrompt: false,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 2,
    attributeSchema: {},
    description: 'Direct costs of producing goods or services'
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    slug: 'operating_expenses',
    name: 'Operating Expenses',
    parentId: null,
    type: 'opex',
    tier: 1,
    isPnL: true,
    includeInPrompt: false,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 3,
    attributeSchema: {},
    description: 'Ongoing business expenses not directly tied to production'
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.taxes_liabilities,
    slug: 'taxes_liabilities',
    name: 'Taxes & Liabilities',
    parentId: null,
    type: 'liability',
    tier: 1,
    isPnL: false,
    includeInPrompt: false,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 4,
    attributeSchema: {},
    description: 'Tax obligations and business liabilities'
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.clearing,
    slug: 'clearing',
    name: 'Clearing Accounts',
    parentId: null,
    type: 'clearing',
    tier: 1,
    isPnL: false,
    includeInPrompt: false,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 5,
    attributeSchema: {},
    description: 'Temporary clearing and suspense accounts for transfers'
  },
  
  // ============================================================================
  // REVENUE CATEGORIES
  // ============================================================================
  {
    id: UNIVERSAL_CATEGORY_IDS.product_sales,
    slug: 'product_sales',
    name: 'Product Sales',
    parentId: UNIVERSAL_CATEGORY_IDS.revenue,
    type: 'revenue',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 1,
    attributeSchema: {
      channel: {
        type: 'enum',
        values: ['online', 'retail', 'wholesale', 'marketplace'],
        required: false,
        description: 'Sales channel'
      },
      product_line: {
        type: 'string',
        required: false,
        description: 'Product category or line'
      }
    },
    description: 'Revenue from selling physical or digital products to customers. USE THIS for actual sales transactions where customers pay for products. DO NOT use for platform subscription fees (use platform_fees), payouts (use payouts_clearing), or shipping charges alone (use shipping_income).',
    examples: ['Online store sales', 'Amazon marketplace sales', 'Wholesale orders', 'Retail store sales', 'Customer purchase #12345']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.service_revenue,
    slug: 'service_revenue',
    name: 'Service Revenue',
    parentId: UNIVERSAL_CATEGORY_IDS.revenue,
    type: 'revenue',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 2,
    attributeSchema: {
      service_type: {
        type: 'string',
        required: false,
        description: 'Type of service provided'
      }
    },
    description: 'Revenue from providing services to customers (labor, consulting, professional services). USE THIS for service-based businesses or when selling expertise/time rather than products.',
    examples: ['Consulting fees', 'Professional services', 'Service appointments', 'Freelance work payment']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.shipping_income,
    slug: 'shipping_income',
    name: 'Shipping Income',
    parentId: UNIVERSAL_CATEGORY_IDS.revenue,
    type: 'revenue',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['ecommerce'],
    isUniversal: false,
    displayOrder: 3,
    attributeSchema: {},
    description: 'Revenue from shipping charges passed to customers (income YOU collect). USE THIS when customers pay shipping fees. DO NOT use for shipping costs YOU pay to carriers (use freight_shipping COGS).',
    examples: ['Shipping fees collected from customer', 'Delivery charges added to order', 'Express shipping fee revenue']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.refunds_contra,
    slug: 'refunds_contra',
    name: 'Refunds (Contra-Revenue)',
    parentId: UNIVERSAL_CATEGORY_IDS.revenue,
    type: 'revenue',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 4,
    attributeSchema: {
      reason: {
        type: 'enum',
        values: ['return', 'cancellation', 'chargeback', 'error', 'other'],
        required: false,
        description: 'Reason for refund'
      }
    },
    description: 'Customer refunds and returns (reduces revenue)',
    examples: ['Customer refund', 'Order cancellation', 'Chargeback']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.discounts_contra,
    slug: 'discounts_contra',
    name: 'Discounts (Contra-Revenue)',
    parentId: UNIVERSAL_CATEGORY_IDS.revenue,
    type: 'revenue',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 5,
    attributeSchema: {},
    description: 'Discounts and promotional allowances (reduces revenue)',
    examples: ['Promotional discount', 'Coupon code', 'Volume discount']
  },
  
  // ============================================================================
  // COGS CATEGORIES
  // ============================================================================
  {
    id: UNIVERSAL_CATEGORY_IDS.materials_supplies,
    slug: 'materials_supplies',
    name: 'Materials & Supplies',
    parentId: UNIVERSAL_CATEGORY_IDS.cogs,
    type: 'cogs',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 1,
    attributeSchema: {
      supplier: {
        type: 'string',
        required: false,
        description: 'Supplier name'
      },
      material_type: {
        type: 'string',
        required: false,
        description: 'Type of material'
      }
    },
    description: 'Raw materials, inventory purchases, and production supplies directly used to create products. USE THIS for supplier invoices, wholesale inventory, raw materials, and manufacturing supplies. DO NOT use for packaging materials (use packaging) or general office supplies (use office_supplies).',
    examples: ['Supplier invoice', 'Alibaba inventory order', 'Wholesale product purchase', 'Raw materials', 'Manufacturing supplies']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.direct_labor,
    slug: 'direct_labor',
    name: 'Direct Labor',
    parentId: UNIVERSAL_CATEGORY_IDS.cogs,
    type: 'cogs',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 2,
    attributeSchema: {},
    description: 'Labor costs directly tied to production or service delivery',
    examples: ['Production worker wages', 'Manufacturing labor', 'Service delivery staff']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.packaging,
    slug: 'packaging',
    name: 'Packaging',
    parentId: UNIVERSAL_CATEGORY_IDS.cogs,
    type: 'cogs',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['ecommerce'],
    isUniversal: false,
    displayOrder: 3,
    attributeSchema: {},
    description: 'Packaging materials for products',
    examples: ['Boxes', 'Bubble wrap', 'Branded packaging', 'Shipping materials']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.freight_shipping,
    slug: 'freight_shipping',
    name: 'Freight & Shipping',
    parentId: UNIVERSAL_CATEGORY_IDS.cogs,
    type: 'cogs',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 4,
    attributeSchema: {
      carrier: {
        type: 'enum',
        values: ['USPS', 'FedEx', 'UPS', 'DHL', 'Other'],
        required: false,
        description: 'Shipping carrier'
      },
      direction: {
        type: 'enum',
        values: ['inbound', 'outbound'],
        required: false,
        description: 'Inbound (to you) or outbound (to customer)'
      }
    },
    description: 'Shipping costs YOU pay to carriers for product fulfillment and freight (COGS, cost of delivery). USE THIS for shipping expenses to fulfill orders, whether inbound from suppliers or outbound to customers. DO NOT use for shipping charges collected from customers (use shipping_income revenue).',
    examples: ['USPS postage to ship order', 'FedEx delivery to customer', 'UPS Ground shipping', 'Freight charges from supplier', 'Shipping label costs']
  },
  
  // ============================================================================
  // OPERATING EXPENSES - UNIVERSAL
  // ============================================================================
  {
    id: UNIVERSAL_CATEGORY_IDS.marketing_ads,
    slug: 'marketing_ads',
    name: 'Marketing & Advertising',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 1,
    attributeSchema: {
      platform: {
        type: 'enum',
        values: ['Meta', 'Google', 'TikTok', 'LinkedIn', 'Pinterest', 'Twitter', 'Snapchat', 'YouTube', 'Other'],
        required: false,
        description: 'Advertising platform or channel'
      },
      campaign_type: {
        type: 'enum',
        values: ['paid_social', 'paid_search', 'display', 'video', 'influencer', 'affiliate', 'email', 'print', 'other'],
        required: false,
        description: 'Type of marketing campaign'
      },
      campaign_name: {
        type: 'string',
        required: false,
        description: 'Campaign identifier'
      }
    },
    description: 'All marketing and advertising expenses for customer acquisition INCLUDING digital ads (Facebook, Google, TikTok), email marketing platforms (Klaviyo, Mailchimp), SEO services, influencer payments, and promotional materials. USE THIS for any expense aimed at acquiring or engaging customers. DO NOT use for general productivity software (use software_subscriptions).',
    examples: [
      'Facebook Ads',
      'Google AdWords',
      'Instagram sponsored post',
      'TikTok advertising',
      'Klaviyo email marketing',
      'Mailchimp subscription',
      'SEO services',
      'Influencer payment',
      'Billboard rental'
    ]
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.software_subscriptions,
    slug: 'software_subscriptions',
    name: 'Software & Technology',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 2,
    attributeSchema: {
      vendor: {
        type: 'string',
        required: false,
        description: 'Software vendor name'
      },
      subscription_type: {
        type: 'enum',
        values: ['monthly', 'annual', 'per_user', 'usage_based', 'one_time'],
        required: false,
        description: 'Billing model'
      },
      category: {
        type: 'enum',
        values: ['accounting', 'crm', 'productivity', 'analytics', 'communication', 'design', 'development', 'marketing', 'other'],
        required: false,
        description: 'Software category'
      }
    },
    description: 'Business software, SaaS subscriptions, and technology tools for operations and productivity INCLUDING accounting (QuickBooks), productivity (Microsoft 365, Slack, Zoom, Asana), design (Adobe, Canva), CRM (Salesforce), and cloud storage. USE THIS for general business software. DO NOT use for e-commerce platforms (use platform_fees), marketing tools focused on customer acquisition (use marketing_ads), or payment processors (use payment_processing_fees).',
    examples: [
      'QuickBooks subscription',
      'Adobe Creative Cloud',
      'Microsoft 365',
      'Salesforce CRM',
      'Slack workspace',
      'Zoom Pro',
      'Canva Pro',
      'Asana project management',
      'Dropbox Business',
      'GitHub subscription'
    ]
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.payment_processing_fees,
    slug: 'payment_processing_fees',
    name: 'Payment Processing Fees',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 3,
    attributeSchema: {
      processor: {
        type: 'enum',
        values: ['Stripe', 'PayPal', 'Square', 'Shopify Payments', 'Authorize.net', 'Afterpay', 'Affirm', 'Klarna', 'Apple Pay', 'Other'],
        required: false,
        description: 'Payment processor name'
      },
      fee_type: {
        type: 'enum',
        values: ['transaction', 'monthly', 'chargeback', 'setup', 'other'],
        required: false,
        description: 'Type of processing fee'
      }
    },
    description: 'Credit card processing fees, payment gateway fees, and transaction charges from payment processors (Stripe, PayPal, Square, BNPL providers). USE THIS for fees charged by payment processors to accept payments. DO NOT use for bank fees (use bank_fees) or platform subscription fees (use platform_fees if e-commerce platform, software_subscriptions if general software).',
    examples: [
      'Stripe transaction fee',
      'PayPal merchant fee',
      'Square processing fee',
      'Afterpay merchant service fee',
      'Affirm processing fee',
      'Klarna merchant fee',
      'Chargeback fee',
      'Payment gateway monthly fee'
    ]
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.labor,
    slug: 'labor',
    name: 'Payroll & Benefits',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 4,
    attributeSchema: {
      role: {
        type: 'string',
        required: false,
        description: 'Job role or position'
      },
      department: {
        type: 'string',
        required: false,
        description: 'Department'
      },
      employment_type: {
        type: 'enum',
        values: ['full_time', 'part_time', 'contractor', 'temp'],
        required: false,
        description: 'Employment type'
      }
    },
    description: 'Salaries, wages, payroll taxes, and employee benefits',
    examples: ['Payroll', 'Employee salary', 'Payroll taxes', 'Health insurance', 'Retirement contributions']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.professional_services,
    slug: 'professional_services',
    name: 'Professional Services',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 5,
    attributeSchema: {
      service_type: {
        type: 'enum',
        values: ['accounting', 'consulting', 'bookkeeping', 'tax_prep', 'other'],
        required: false,
        description: 'Type of professional service'
      },
      provider: {
        type: 'string',
        required: false,
        description: 'Service provider name'
      }
    },
    description: 'Professional advisory services including accounting, bookkeeping, business consulting, and tax preparation. USE THIS for CPA fees, business consultants, and tax prep services. DO NOT use for ongoing legal fees or compliance work (use legal_compliance) or direct labor on products (use direct_labor COGS).',
    examples: ['CPA fees', 'Business consultant', 'Tax preparation', 'Bookkeeping services', 'Financial advisory', 'Business strategy consultant']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.rent_utilities,
    slug: 'rent_utilities',
    name: 'Rent & Utilities',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 6,
    attributeSchema: {
      facility: {
        type: 'string',
        required: false,
        description: 'Facility or location'
      },
      utility_type: {
        type: 'enum',
        values: ['electric', 'gas', 'water', 'internet', 'other'],
        required: false,
        description: 'Type of utility'
      }
    },
    description: 'Rent, utilities, and facility costs including office rent, warehouse rent, electricity, water, gas, internet service. USE THIS for facilities and basic utilities. DO NOT use for mobile phones or business phone systems (use telecommunications) or 3PL fulfillment services (use fulfillment_logistics).',
    examples: ['Office rent', 'Warehouse rent', 'Electricity bill', 'Water bill', 'Internet service', 'Co-working space', 'Natural gas', 'Sewer charges']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.insurance,
    slug: 'insurance',
    name: 'Insurance',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 7,
    attributeSchema: {
      policy_type: {
        type: 'enum',
        values: ['general_liability', 'property', 'professional_liability', 'workers_comp', 'vehicle', 'other'],
        required: false,
        description: 'Type of insurance policy'
      },
      carrier: {
        type: 'string',
        required: false,
        description: 'Insurance carrier'
      }
    },
    description: 'Business insurance premiums',
    examples: ['General liability insurance', 'Property insurance', 'Professional liability', 'Workers compensation']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.office_supplies,
    slug: 'office_supplies',
    name: 'Office Supplies',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 8,
    attributeSchema: {},
    description: 'Office supplies, equipment, and general operational supplies for business operations (NOT product-related). USE THIS for general business supplies like printer paper, pens, office furniture, cleaning supplies. DO NOT use for packaging materials for products (use packaging COGS) or materials used in production (use materials_supplies COGS).',
    examples: ['Printer paper', 'Pens and pencils', 'Office equipment', 'Cleaning supplies', 'Desk chairs', 'Filing cabinets']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.travel_meals,
    slug: 'travel_meals',
    name: 'Travel & Meals',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 9,
    attributeSchema: {
      trip_purpose: {
        type: 'string',
        required: false,
        description: 'Purpose of trip'
      },
      location: {
        type: 'string',
        required: false,
        description: 'Travel destination'
      }
    },
    description: 'Business travel expenses including airfare, hotels, rental cars, and business meals/entertainment. USE THIS for travel-related expenses when away from primary business location. DO NOT use for daily commuting, local transportation, or vehicle operating costs (use vehicle_transportation).',
    examples: ['Airfare', 'Hotel', 'Business meal', 'Client dinner', 'Conference registration', 'Rental car during business trip', 'Uber to airport for trip']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.bank_fees,
    slug: 'bank_fees',
    name: 'Bank & Merchant Fees',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 10,
    attributeSchema: {
      fee_type: {
        type: 'enum',
        values: ['monthly', 'overdraft', 'wire_transfer', 'atm', 'other'],
        required: false,
        description: 'Type of bank fee'
      },
      institution: {
        type: 'string',
        required: false,
        description: 'Financial institution'
      }
    },
    description: 'Bank fees, wire transfer fees, and other financial service charges',
    examples: ['Monthly account fee', 'Wire transfer fee', 'Overdraft charge', 'ATM fee']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.telecommunications,
    slug: 'telecommunications',
    name: 'Telecommunications',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 11,
    attributeSchema: {
      service_type: {
        type: 'enum',
        values: ['mobile', 'landline', 'voip', 'conferencing', 'other'],
        required: false,
        description: 'Type of telecom service'
      },
      provider: {
        type: 'string',
        required: false,
        description: 'Telecom provider name'
      }
    },
    description: 'Business phone and communications systems including mobile phones, business phone lines, VoIP services, and video conferencing subscriptions (Zoom Phone, not general Zoom subscription). USE THIS for all phone/telecom services. DO NOT use for internet service (use rent_utilities) or general software (use software_subscriptions).',
    examples: ['AT&T business mobile', 'Verizon phone bill', 'RingCentral VoIP', 'Business phone line', 'Cell phone plan', 'Zoom Phone subscription', 'Conference call service']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.vehicle_transportation,
    slug: 'vehicle_transportation',
    name: 'Vehicle & Transportation',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 12,
    attributeSchema: {
      expense_type: {
        type: 'enum',
        values: ['fuel', 'maintenance', 'payment', 'insurance', 'rideshare', 'parking', 'tolls', 'other'],
        required: false,
        description: 'Type of vehicle expense'
      },
      vehicle: {
        type: 'string',
        required: false,
        description: 'Vehicle identifier'
      }
    },
    description: 'Daily vehicle and local transportation expenses including gas, car payments, vehicle maintenance, rideshare for local business, parking, and tolls. USE THIS for vehicle operating costs and daily/local transportation. DO NOT use for business travel away from home office (use travel_meals for Uber to airport, rental cars during trips).',
    examples: ['Gas station fill-up', 'Car payment', 'Oil change', 'Uber to client meeting', 'Lyft to office', 'Parking meter', 'Toll road', 'Vehicle registration', 'Car wash']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.repairs_maintenance,
    slug: 'repairs_maintenance',
    name: 'Repairs & Maintenance',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 13,
    attributeSchema: {
      asset_type: {
        type: 'enum',
        values: ['building', 'equipment', 'machinery', 'hvac', 'plumbing', 'electrical', 'other'],
        required: false,
        description: 'Type of asset being repaired'
      },
      vendor: {
        type: 'string',
        required: false,
        description: 'Repair service provider'
      }
    },
    description: 'Repairs and maintenance of business property, equipment, and facilities (NOT vehicles). USE THIS for building repairs, equipment servicing, HVAC maintenance, plumbing, electrical work. DO NOT use for vehicle maintenance (use vehicle_transportation) or product-related repairs (use materials_supplies COGS).',
    examples: ['HVAC repair', 'Plumbing service', 'Equipment maintenance', 'Building repair', 'Electrical contractor', 'Roof repair', 'Appliance repair', 'Landscape maintenance']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.legal_compliance,
    slug: 'legal_compliance',
    name: 'Legal & Compliance',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 14,
    attributeSchema: {
      service_type: {
        type: 'enum',
        values: ['legal_fees', 'trademark', 'patents', 'regulatory', 'compliance', 'litigation', 'contracts', 'other'],
        required: false,
        description: 'Type of legal service'
      },
      firm: {
        type: 'string',
        required: false,
        description: 'Law firm or legal provider name'
      }
    },
    description: 'Legal services, regulatory compliance, and related fees including attorney fees, trademark/patent filings, regulatory compliance costs, and litigation. USE THIS for all legal and compliance-related expenses. DO NOT use for one-time business formation (could use miscellaneous) or tax preparation (use professional_services).',
    examples: ['Attorney fees', 'Law firm retainer', 'Trademark filing', 'Patent application', 'Legal consultation', 'Contract review by lawyer', 'Compliance audit', 'Regulatory filing fees']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.miscellaneous,
    slug: 'miscellaneous',
    name: 'Miscellaneous',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 99,
    attributeSchema: {
      note: {
        type: 'string',
        required: false,
        description: 'Note about transaction'
      }
    },
    description: 'Miscellaneous expenses that don\'t fit other categories',
    examples: ['Unclear expense', 'One-time charge', 'Unclassified expense']
  },
  
  // ============================================================================
  // OPERATING EXPENSES - INDUSTRY-SPECIFIC
  // ============================================================================
  {
    id: UNIVERSAL_CATEGORY_IDS.fulfillment_logistics,
    slug: 'fulfillment_logistics',
    name: 'Fulfillment & Logistics',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['ecommerce'],
    isUniversal: false,
    displayOrder: 20,
    attributeSchema: {
      provider: {
        type: 'enum',
        values: ['ShipBob', 'ShipMonk', 'Deliverr', 'Amazon FBA', 'In-house', 'Other'],
        required: false,
        description: '3PL provider'
      },
      service_type: {
        type: 'enum',
        values: ['pick_pack', 'storage', 'receiving', 'returns', 'other'],
        required: false,
        description: 'Type of fulfillment service'
      }
    },
    description: 'Third-party logistics (3PL), warehouse operations, and fulfillment center fees for e-commerce (NOT direct rent). USE THIS for 3PL services like ShipBob, Amazon FBA, Deliverr that handle fulfillment. DO NOT use for warehouse rent YOU pay (use rent_utilities) or shipping costs to customers (use freight_shipping COGS).',
    examples: [
      'ShipBob fulfillment fee',
      'Amazon FBA fulfillment fees',
      '3PL storage fees',
      'Pick and pack services',
      'Returns processing by 3PL',
      'Deliverr fulfillment'
    ]
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.platform_fees,
    slug: 'platform_fees',
    name: 'Platform Fees',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['ecommerce'],
    isUniversal: false,
    displayOrder: 21,
    attributeSchema: {
      platform: {
        type: 'enum',
        values: ['Shopify', 'Amazon', 'Etsy', 'eBay', 'WooCommerce', 'Other'],
        required: false,
        description: 'E-commerce platform'
      },
      fee_type: {
        type: 'enum',
        values: ['monthly', 'transaction', 'listing', 'referral', 'other'],
        required: false,
        description: 'Type of platform fee'
      }
    },
    description: 'E-commerce platform subscription and transaction fees paid TO platforms like Shopify, Amazon, Etsy. USE THIS for fees YOU pay to platforms for using their services. DO NOT use for sales revenue (use product_sales), payouts (use payouts_clearing), or payment processing fees (use payment_processing_fees).',
    examples: [
      'Shopify monthly subscription',
      'Amazon seller fees',
      'Etsy listing fees',
      'eBay final value fees',
      'Marketplace transaction fees'
    ]
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.hosting_infrastructure,
    slug: 'hosting_infrastructure',
    name: 'Hosting & Infrastructure',
    parentId: UNIVERSAL_CATEGORY_IDS.operating_expenses,
    type: 'opex',
    tier: 2,
    isPnL: true,
    includeInPrompt: true,
    industries: ['saas'],
    isUniversal: false,
    displayOrder: 22,
    attributeSchema: {
      provider: {
        type: 'enum',
        values: ['AWS', 'Google Cloud', 'Azure', 'Heroku', 'Vercel', 'DigitalOcean', 'Other'],
        required: false,
        description: 'Cloud provider'
      },
      service_tier: {
        type: 'string',
        required: false,
        description: 'Service tier or plan'
      }
    },
    description: 'Cloud hosting, servers, and infrastructure costs',
    examples: [
      'AWS hosting',
      'Google Cloud services',
      'Azure compute',
      'CDN costs',
      'Database hosting'
    ]
  },
  
  // ============================================================================
  // NON-P&L CATEGORIES
  // ============================================================================
  {
    id: UNIVERSAL_CATEGORY_IDS.sales_tax_payable,
    slug: 'sales_tax_payable',
    name: 'Sales Tax Payable',
    parentId: UNIVERSAL_CATEGORY_IDS.taxes_liabilities,
    type: 'liability',
    tier: 2,
    isPnL: false,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 1,
    attributeSchema: {},
    description: 'Sales tax collected from customers (liability account, NOT revenue). USE THIS for sales tax you collect and must remit to tax authorities. This is money you hold temporarily, not income.',
    examples: ['Sales tax collected', 'State sales tax', 'Sales tax remittance', 'Tax liability']
  },
  {
    id: UNIVERSAL_CATEGORY_IDS.payouts_clearing,
    slug: 'payouts_clearing',
    name: 'Payouts Clearing',
    parentId: UNIVERSAL_CATEGORY_IDS.clearing,
    type: 'clearing',
    tier: 2,
    isPnL: false,
    includeInPrompt: true,
    industries: ['all'],
    isUniversal: true,
    displayOrder: 1,
    attributeSchema: {
      platform: {
        type: 'enum',
        values: ['Shopify', 'Square', 'Stripe', 'PayPal', 'Other'],
        required: false,
        description: 'Payment platform'
      }
    },
    description: 'Platform payouts that transfer money to your bank (clearing account, NOT new revenue). USE THIS for payouts from Shopify, Square, Stripe, etc. These are transfers of money already earned, not new sales. The revenue was already recorded when the sale happened.',
    examples: ['Shopify payout', 'Square payout', 'Stripe transfer', 'PayPal deposit', 'Platform transfer to bank']
  },
];

/**
 * Get categories for a specific industry
 */
export function getCategoriesForIndustry(industry: Industry): UniversalCategory[] {
  return UNIVERSAL_TAXONOMY.filter(
    cat => cat.industries.includes('all') || cat.industries.includes(industry)
  );
}

/**
 * Get prompt-eligible categories for an industry
 */
export function getPromptCategoriesForIndustry(industry: Industry): UniversalCategory[] {
  return UNIVERSAL_TAXONOMY.filter(
    cat => cat.includeInPrompt && (cat.industries.includes('all') || cat.industries.includes(industry))
  );
}

/**
 * Get category by slug
 */
export function getCategoryBySlug(slug: string): UniversalCategory | undefined {
  return UNIVERSAL_TAXONOMY.find(c => c.slug === slug);
}

/**
 * Get category by ID
 */
export function getCategoryById(id: string): UniversalCategory | undefined {
  return UNIVERSAL_TAXONOMY.find(c => c.id === id);
}

/**
 * Validate attributes against category schema
 */
export function validateAttributes(
  categorySlug: string,
  attributes: Record<string, any>
): { valid: boolean; errors: string[] } {
  const category = getCategoryBySlug(categorySlug);
  if (!category) {
    return { valid: false, errors: [`Unknown category: ${categorySlug}`] };
  }

  const errors: string[] = [];
  const schema = category.attributeSchema;

  for (const [key, value] of Object.entries(attributes)) {
    const attrSchema = schema[key];
    
    if (!attrSchema) {
      errors.push(`Attribute "${key}" not defined in schema for ${categorySlug}`);
      continue;
    }

    // Check required
    if (attrSchema.required && (value === null || value === undefined || value === '')) {
      errors.push(`Required attribute "${key}" is missing`);
    }

    // Validate enum
    if (attrSchema.type === 'enum' && attrSchema.values && value) {
      if (!attrSchema.values.includes(value)) {
        errors.push(
          `Invalid value "${value}" for attribute "${key}". Expected one of: ${attrSchema.values.join(', ')}`
        );
      }
    }

    // Validate type
    if (attrSchema.type === 'number' && value && typeof value !== 'number') {
      errors.push(`Attribute "${key}" must be a number`);
    }

    if (attrSchema.type === 'boolean' && value && typeof value !== 'boolean') {
      errors.push(`Attribute "${key}" must be a boolean`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Map category slug to ID
 */
export function mapCategorySlugToId(slug: string): string {
  const category = getCategoryBySlug(slug);
  if (category) {
    return category.id;
  }
  
  // Fallback to miscellaneous
  return UNIVERSAL_CATEGORY_IDS.miscellaneous;
}

