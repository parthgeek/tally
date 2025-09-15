import type { LabTransaction } from './types';

/**
 * Ambiguous transaction test scenarios for categorizer validation
 * These scenarios test edge cases and ambiguous merchant/transaction patterns
 */

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  transactions: LabTransaction[];
  expectedChallenges: string[];
}

/**
 * Amazon transactions - can be retail supplies, subscriptions, or various business expenses
 */
const amazonScenario: TestScenario = {
  id: 'amazon-ambiguity',
  name: 'Amazon Ambiguity',
  description: 'Amazon transactions that could be office supplies, software subscriptions, or equipment',
  expectedChallenges: [
    'Distinguishing between office supplies and inventory',
    'Identifying subscription vs one-time purchases',
    'Separating personal vs business expenses'
  ],
  transactions: [
    {
      id: 'amazon-1',
      description: 'AMAZON.COM*OFFICE SUPPLIES',
      merchantName: 'Amazon',
      amountCents: '4567',
      mcc: '5942', // Book stores/stationery
      categoryId: 'office_supplies', // Ground truth for testing
      date: '2024-01-15',
      currency: 'USD',
    },
    {
      id: 'amazon-2',
      description: 'AMAZON WEB SERVICES',
      merchantName: 'Amazon',
      amountCents: '12450',
      mcc: '7372', // Computer programming services
      categoryId: 'software', // Ground truth
      date: '2024-01-16',
      currency: 'USD',
    },
    {
      id: 'amazon-3',
      description: 'AMAZON.COM*RETAIL',
      merchantName: 'Amazon',
      amountCents: '8900',
      mcc: '5942',
      categoryId: 'supplies', // Ambiguous - could be supplies or inventory
      date: '2024-01-17',
      currency: 'USD',
    },
    {
      id: 'amazon-4',
      description: 'AMAZON PRIME MEMBERSHIP',
      merchantName: 'Amazon',
      amountCents: '1499',
      mcc: '5968', // Continuity/subscription merchants
      categoryId: 'software', // Subscription service
      date: '2024-01-18',
      currency: 'USD',
    }
  ]
};

/**
 * 7-Eleven transactions - can be fuel, convenience store items, or office supplies
 */
const sevenElevenScenario: TestScenario = {
  id: 'seven-eleven-ambiguity',
  name: '7-Eleven Fuel vs Convenience',
  description: '7-Eleven transactions that could be fuel or convenience store purchases',
  expectedChallenges: [
    'Distinguishing fuel from convenience store purchases',
    'Small amounts vs fuel amounts',
    'Location and time context'
  ],
  transactions: [
    {
      id: '7eleven-1',
      description: '7-ELEVEN #12345 FUEL',
      merchantName: '7-Eleven',
      amountCents: '4567',
      mcc: '5541', // Service stations
      categoryId: 'travel', // Fuel for business travel
      date: '2024-01-15',
      currency: 'USD',
    },
    {
      id: '7eleven-2',
      description: '7-ELEVEN #12345',
      merchantName: '7-Eleven',
      amountCents: '892', // Small amount - likely convenience
      mcc: '5499', // Miscellaneous food stores
      categoryId: 'supplies', // Office snacks/supplies
      date: '2024-01-16',
      currency: 'USD',
    },
    {
      id: '7eleven-3',
      description: '7-ELEVEN STORE #67890',
      merchantName: '7-Eleven',
      amountCents: '2340',
      mcc: '5499',
      categoryId: 'supplies', // Medium amount - could be bulk office supplies
      date: '2024-01-17',
      currency: 'USD',
    },
    {
      id: '7eleven-4',
      description: '7-ELEVEN FUEL PUMP #5',
      merchantName: '7-Eleven',
      amountCents: '6789',
      mcc: '5541',
      categoryId: 'travel', // Clearly fuel based on description
      date: '2024-01-18',
      currency: 'USD',
    }
  ]
};

/**
 * Generic bill payment transactions - utilities, software, services, etc.
 */
const genericBillScenario: TestScenario = {
  id: 'generic-bills',
  name: 'Generic Bill Payments',
  description: 'Generic bill descriptors that require context clues for categorization',
  expectedChallenges: [
    'Limited descriptor information',
    'Multiple possible categories',
    'Distinguishing utilities from services'
  ],
  transactions: [
    {
      id: 'bill-1',
      description: 'BILL PAYMENT AUTOPAY',
      merchantName: 'Autopay Service',
      amountCents: '15600',
      mcc: '4900', // Utilities
      categoryId: 'rent_utilities',
      date: '2024-01-15',
      currency: 'USD',
    },
    {
      id: 'bill-2',
      description: 'MONTHLY BILL PAYMENT',
      merchantName: 'Generic Billing Co',
      amountCents: '8900',
      mcc: undefined, // No MCC - maximum ambiguity
      categoryId: 'software', // Could be many things
      date: '2024-01-16',
      currency: 'USD',
    },
    {
      id: 'bill-3',
      description: 'AUTOMATED PAYMENT',
      merchantName: 'Payment Processor',
      amountCents: '24500',
      mcc: '6012', // Financial institutions
      categoryId: 'bank_fees',
      date: '2024-01-17',
      currency: 'USD',
    },
    {
      id: 'bill-4',
      description: 'SUBSCRIPTION BILLING',
      merchantName: 'Billing Service',
      amountCents: '4999',
      mcc: '5968', // Continuity/subscription
      categoryId: 'software',
      date: '2024-01-18',
      currency: 'USD',
    }
  ]
};

/**
 * Restaurant vs retail ambiguity
 */
const restaurantRetailScenario: TestScenario = {
  id: 'restaurant-retail',
  name: 'Restaurant vs Retail',
  description: 'Merchants that have both restaurant and retail operations',
  expectedChallenges: [
    'Stores with food courts vs retail sections',
    'Amount-based disambiguation',
    'Time of day context'
  ],
  transactions: [
    {
      id: 'walmart-1',
      description: 'WALMART SUPERCENTER',
      merchantName: 'Walmart',
      amountCents: '4567',
      mcc: '5411', // Grocery stores
      categoryId: 'supplies', // Business supplies shopping
      date: '2024-01-15',
      currency: 'USD',
    },
    {
      id: 'walmart-2',
      description: 'WALMART NEIGHBORHOOD MARKET',
      merchantName: 'Walmart',
      amountCents: '1234',
      mcc: '5411',
      categoryId: 'supplies', // Small grocery/office supplies
      date: '2024-01-16',
      currency: 'USD',
    },
    {
      id: 'target-1',
      description: 'TARGET STARBUCKS',
      merchantName: 'Target',
      amountCents: '567',
      mcc: '5814', // Fast food restaurants
      categoryId: 'business_meals', // Coffee during work
      date: '2024-01-17',
      currency: 'USD',
    },
    {
      id: 'target-2',
      description: 'TARGET T-1234',
      merchantName: 'Target',
      amountCents: '8900',
      mcc: '5310', // Discount stores
      categoryId: 'supplies', // Office/business supplies
      date: '2024-01-18',
      currency: 'USD',
    }
  ]
};

/**
 * Tech company payments - could be software, equipment, services
 */
const techServicesScenario: TestScenario = {
  id: 'tech-services',
  name: 'Tech Services Ambiguity',
  description: 'Technology company charges that could be software, equipment, or services',
  expectedChallenges: [
    'Software vs hardware purchases',
    'One-time vs subscription billing',
    'Equipment vs service contracts'
  ],
  transactions: [
    {
      id: 'apple-1',
      description: 'APPLE.COM/BILL',
      merchantName: 'Apple',
      amountCents: '99999',
      mcc: '5732', // Electronics stores
      categoryId: 'equipment', // Likely hardware given amount
      date: '2024-01-15',
      currency: 'USD',
    },
    {
      id: 'apple-2',
      description: 'APPLE.COM/BILL',
      merchantName: 'Apple',
      amountCents: '999',
      mcc: '5732',
      categoryId: 'software', // Small amount - likely app/software
      date: '2024-01-16',
      currency: 'USD',
    },
    {
      id: 'microsoft-1',
      description: 'MICROSOFT*365 BUSINESS',
      merchantName: 'Microsoft',
      amountCents: '1500',
      mcc: '5734', // Computer software stores
      categoryId: 'software',
      date: '2024-01-17',
      currency: 'USD',
    },
    {
      id: 'google-1',
      description: 'GOOGLE *ADS',
      merchantName: 'Google',
      amountCents: '25000',
      mcc: '7311', // Advertising agencies
      categoryId: 'marketing',
      date: '2024-01-18',
      currency: 'USD',
    }
  ]
};

/**
 * All available test scenarios
 */
export const TEST_SCENARIOS: TestScenario[] = [
  amazonScenario,
  sevenElevenScenario,
  genericBillScenario,
  restaurantRetailScenario,
  techServicesScenario
];

/**
 * Get scenario by ID
 */
export function getScenario(id: string): TestScenario | undefined {
  return TEST_SCENARIOS.find(scenario => scenario.id === id);
}

/**
 * Get all scenario names for UI selection
 */
export function getScenarioNames(): Array<{ id: string; name: string; description: string }> {
  return TEST_SCENARIOS.map(scenario => ({
    id: scenario.id,
    name: scenario.name,
    description: scenario.description
  }));
}

/**
 * Combine multiple scenarios into a mixed dataset
 */
export function createMixedScenario(scenarioIds: string[]): LabTransaction[] {
  const transactions: LabTransaction[] = [];

  for (const id of scenarioIds) {
    const scenario = getScenario(id);
    if (scenario) {
      transactions.push(...scenario.transactions);
    }
  }

  return transactions;
}

/**
 * Create a comprehensive ambiguity test dataset
 */
export function createComprehensiveAmbiguityDataset(): LabTransaction[] {
  return createMixedScenario([
    'amazon-ambiguity',
    'seven-eleven-ambiguity',
    'generic-bills',
    'restaurant-retail',
    'tech-services'
  ]);
}