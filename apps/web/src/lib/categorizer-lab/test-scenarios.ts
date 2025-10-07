import type { LabTransaction } from "./types";

/**
 * E-commerce transaction test scenarios for categorizer validation
 * These scenarios test edge cases and ambiguous merchant/transaction patterns specific to e-commerce businesses
 */

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  transactions: LabTransaction[];
  expectedChallenges: string[];
}

/**
 * Shopify ecosystem transactions - platform fees, payouts, and app subscriptions
 */
const shopifyEcosystemScenario: TestScenario = {
  id: "shopify-ecosystem",
  name: "Shopify Ecosystem",
  description: "Shopify platform fees, payouts, and app ecosystem transactions",
  expectedChallenges: [
    "Distinguishing between platform fees and payouts",
    "Categorizing various Shopify app subscriptions",
    "Handling payout clearing vs revenue recognition",
  ],
  transactions: [
    {
      id: "shopify-1",
      description: "SHOPIFY SUBSCRIPTION FEE",
      merchantName: "Shopify",
      amountCents: "2900",
      mcc: "5734",
      categoryId: "shopify_platform",
      date: "2024-01-15",
      currency: "USD",
    },
    {
      id: "shopify-2",
      description: "SHOPIFY PAYOUT - SALES WEEK OF 01/08",
      merchantName: "Shopify Payments",
      amountCents: "145670",
      mcc: "6012",
      categoryId: "shopify_payouts_clearing",
      date: "2024-01-16",
      currency: "USD",
    },
    {
      id: "shopify-3",
      description: "KLAVIYO EMAIL MARKETING",
      merchantName: "Klaviyo",
      amountCents: "15000",
      mcc: "5734",
      categoryId: "email_sms_tools",
      date: "2024-01-17",
      currency: "USD",
    },
  ],
};

/**
 * Payment processing fees - different processors and fee types
 */
const paymentProcessingScenario: TestScenario = {
  id: "payment-processing",
  name: "Payment Processing Fees",
  description: "Various payment processor fees and transaction costs",
  expectedChallenges: [
    "Distinguishing between different payment processors",
    "Categorizing processor-specific vs general fees",
    "Handling BNPL and alternative payment methods",
  ],
  transactions: [
    {
      id: "stripe-1",
      description: "STRIPE TRANSACTION FEE",
      merchantName: "Stripe",
      amountCents: "350",
      mcc: "6012",
      categoryId: "stripe_fees",
      date: "2024-01-15",
      currency: "USD",
    },
    {
      id: "paypal-1",
      description: "PAYPAL MERCHANT SERVICES",
      merchantName: "PayPal",
      amountCents: "890",
      mcc: "6012",
      categoryId: "paypal_fees",
      date: "2024-01-16",
      currency: "USD",
    },
    {
      id: "afterpay-1",
      description: "AFTERPAY MERCHANT FEE",
      merchantName: "Afterpay",
      amountCents: "1250",
      mcc: "6012",
      categoryId: "bnpl_fees",
      date: "2024-01-17",
      currency: "USD",
    },
  ],
};

/**
 * Digital advertising spend across multiple platforms
 */
const digitalAdvertisingScenario: TestScenario = {
  id: "digital-advertising",
  name: "Digital Advertising",
  description: "Ad spend across Meta, Google, TikTok and other platforms",
  expectedChallenges: [
    "Distinguishing between different ad platforms",
    "Categorizing organic vs paid social spend",
    "Handling retargeting vs acquisition campaigns",
  ],
  transactions: [
    {
      id: "meta-ads-1",
      description: "FACEBOOK ADS CAMPAIGN - DECEMBER",
      merchantName: "Meta Platforms",
      amountCents: "125000",
      mcc: "7311",
      categoryId: "ads_meta",
      date: "2024-01-15",
      currency: "USD",
    },
    {
      id: "google-ads-1",
      description: "GOOGLE ADS - SEARCH CAMPAIGNS",
      merchantName: "Google",
      amountCents: "87500",
      mcc: "7311",
      categoryId: "ads_google",
      date: "2024-01-16",
      currency: "USD",
    },
    {
      id: "tiktok-ads-1",
      description: "TIKTOK FOR BUSINESS",
      merchantName: "TikTok",
      amountCents: "45000",
      mcc: "7311",
      categoryId: "ads_tiktok",
      date: "2024-01-17",
      currency: "USD",
    },
  ],
};

/**
 * Fulfillment and logistics operations
 */
const fulfillmentLogisticsScenario: TestScenario = {
  id: "fulfillment-logistics",
  name: "Fulfillment & Logistics",
  description: "Shipping, warehousing, and 3PL operations",
  expectedChallenges: [
    "Distinguishing between shipping income and expense",
    "Categorizing 3PL vs direct shipping costs",
    "Handling returns processing vs regular fulfillment",
  ],
  transactions: [
    {
      id: "shipbob-1",
      description: "SHIPBOB FULFILLMENT SERVICES",
      merchantName: "ShipBob",
      amountCents: "235000",
      mcc: "4215",
      categoryId: "fulfillment_3pl_fees",
      date: "2024-01-15",
      currency: "USD",
    },
    {
      id: "ups-1",
      description: "UPS SHIPPING CHARGES",
      merchantName: "UPS",
      amountCents: "45670",
      mcc: "4215",
      categoryId: "shipping_expense",
      date: "2024-01-16",
      currency: "USD",
    },
    {
      id: "warehouse-1",
      description: "WAREHOUSE STORAGE - JANUARY",
      merchantName: "Industrial Storage Solutions",
      amountCents: "125000",
      mcc: "4225",
      categoryId: "warehouse_storage",
      date: "2024-01-17",
      currency: "USD",
    },
  ],
};

/**
 * Inventory and manufacturing costs
 */
const inventoryManufacturingScenario: TestScenario = {
  id: "inventory-manufacturing",
  name: "Inventory & Manufacturing",
  description: "Product costs, packaging, and manufacturing expenses",
  expectedChallenges: [
    "Distinguishing COGS from operating expenses",
    "Categorizing packaging vs shipping materials",
    "Handling manufacturing vs fulfillment costs",
  ],
  transactions: [
    {
      id: "supplier-1",
      description: "WHOLESALE PRODUCT PURCHASE",
      merchantName: "ABC Manufacturing Co",
      amountCents: "500000",
      mcc: "5099",
      categoryId: "inventory_purchases",
      date: "2024-01-15",
      currency: "USD",
    },
    {
      id: "packaging-1",
      description: "CUSTOM PACKAGING SUPPLIES",
      merchantName: "PackagingCorp",
      amountCents: "45000",
      mcc: "5111",
      categoryId: "packaging_supplies",
      date: "2024-01-16",
      currency: "USD",
    },
    {
      id: "manufacturing-1",
      description: "PRODUCTION RUN - SKU ABC123",
      merchantName: "Contract Manufacturing Ltd",
      amountCents: "230000",
      mcc: "3999",
      categoryId: "manufacturing_costs",
      date: "2024-01-17",
      currency: "USD",
    },
  ],
};

/**
 * Refunds and contra-revenue scenarios
 */
const refundsContraRevenueScenario: TestScenario = {
  id: "refunds-contra-revenue",
  name: "Refunds & Contra-Revenue",
  description: "Customer refunds, returns, and discount scenarios",
  expectedChallenges: [
    "Preventing refunds from mapping to positive revenue",
    "Distinguishing refunds from returns processing costs",
    "Handling partial vs full refunds",
  ],
  transactions: [
    {
      id: "refund-1",
      description: "CUSTOMER REFUND - ORDER #12345",
      merchantName: "INTERNAL REFUND",
      amountCents: "-15000",
      mcc: "",
      categoryId: "refunds_allowances_contra",
      date: "2024-01-15",
      currency: "USD",
    },
    {
      id: "discount-1",
      description: "PROMOTIONAL DISCOUNT APPLIED",
      merchantName: "INTERNAL ADJUSTMENT",
      amountCents: "-2500",
      mcc: "",
      categoryId: "discounts_contra",
      date: "2024-01-16",
      currency: "USD",
    },
    {
      id: "returns-processing-1",
      description: "RETURN PROCESSING FEE",
      merchantName: "Returns Management Co",
      amountCents: "750",
      mcc: "4215",
      categoryId: "returns_processing",
      date: "2024-01-17",
      currency: "USD",
    },
  ],
};

/**
 * Sales tax and liability scenarios
 */
const salesTaxLiabilityScenario: TestScenario = {
  id: "sales-tax-liability",
  name: "Sales Tax & Liability",
  description: "Sales tax payments and liability account management",
  expectedChallenges: [
    "Routing tax payments to liability accounts",
    "Preventing tax from mapping to P&L",
    "Distinguishing sales tax from other business taxes",
  ],
  transactions: [
    {
      id: "sales-tax-1",
      description: "SALES TAX PAYMENT - Q4 2023",
      merchantName: "State of California",
      amountCents: "25000",
      mcc: "9311",
      categoryId: "sales_tax_payable",
      date: "2024-01-15",
      currency: "USD",
    },
    {
      id: "sales-tax-2",
      description: "LOCAL SALES TAX REMITTANCE",
      merchantName: "City of Los Angeles",
      amountCents: "8500",
      mcc: "9311",
      categoryId: "sales_tax_payable",
      date: "2024-01-16",
      currency: "USD",
    },
  ],
};

/**
 * All test scenarios for e-commerce categorization
 */
export const TEST_SCENARIOS: TestScenario[] = [
  shopifyEcosystemScenario,
  paymentProcessingScenario,
  digitalAdvertisingScenario,
  fulfillmentLogisticsScenario,
  inventoryManufacturingScenario,
  refundsContraRevenueScenario,
  salesTaxLiabilityScenario,
];

/**
 * Get all test transactions across scenarios
 */
export function getAllTestTransactions(): LabTransaction[] {
  return TEST_SCENARIOS.flatMap((scenario) => scenario.transactions);
}

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): TestScenario | undefined {
  return TEST_SCENARIOS.find((scenario) => scenario.id === id);
}

/**
 * Get transactions for specific scenario
 */
export function getTransactionsByScenario(scenarioId: string): LabTransaction[] {
  const scenario = getScenarioById(scenarioId);
  return scenario?.transactions || [];
}
