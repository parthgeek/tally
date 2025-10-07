import type { LabTransaction, SyntheticOptions } from "./types";

/**
 * Generate synthetic transaction data for testing
 */
export function generateSyntheticData(options: SyntheticOptions): LabTransaction[] {
  const rng = createSeededRNG(options.seed || "default-seed");
  const transactions: LabTransaction[] = [];

  const { count, vendorNoisePercent, mccMix, positiveNegativeRatio } = options;

  // Get vendor templates based on mix
  const vendors = getVendorTemplates(mccMix);

  for (let i = 0; i < count; i++) {
    const vendor = vendors[Math.floor(rng() * vendors.length)]!;
    const isExpense = rng() < positiveNegativeRatio;

    // Generate base transaction
    const transaction: LabTransaction = {
      id: `synthetic-${i + 1}`,
      description: generateDescription(vendor, vendorNoisePercent, rng),
      merchantName: generateMerchantName(vendor, vendorNoisePercent, rng),
      mcc: vendor.mcc,
      amountCents: generateAmount(vendor.categoryId, isExpense, rng),
      date: generateDate(rng),
      currency: "USD",
      categoryId: vendor.categoryId, // Ground truth
    };

    transactions.push(transaction);
  }

  return transactions;
}

/**
 * Create a seeded random number generator for deterministic results
 */
function createSeededRNG(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  let state = Math.abs(hash);

  return function () {
    // Linear congruential generator
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
}

/**
 * Vendor templates with typical patterns
 */
interface VendorTemplate {
  name: string;
  variations: string[];
  descriptions: string[];
  mcc: string;
  categoryId: string;
  amountRange: [number, number]; // in cents
}

function getVendorTemplates(mccMix: SyntheticOptions["mccMix"]): VendorTemplate[] {
  const restaurant: VendorTemplate[] = [
    {
      name: "McDonald's",
      variations: ["McDONALD'S", "MCDONALDS", "MCD"],
      descriptions: ["MCDONALD'S #12345", "MCD RESTAURANT", "MCDONALDS CORP"],
      mcc: "5814",
      categoryId: "meals",
      amountRange: [500, 3000], // $5-30
    },
    {
      name: "Starbucks",
      variations: ["STARBUCKS", "SBUX", "STARBUCKS COFFEE"],
      descriptions: ["STARBUCKS STORE #1234", "SBUX COFFEE", "STARBUCKS CORP"],
      mcc: "5814",
      categoryId: "meals",
      amountRange: [300, 1500], // $3-15
    },
    {
      name: "Olive Garden",
      variations: ["OLIVE GARDEN", "OLIVEGARDEN", "OLIVE GDN"],
      descriptions: ["OLIVE GARDEN #123", "OLIVE GARDEN RESTAURANT", "OLIVEGARDEN"],
      mcc: "5812",
      categoryId: "meals",
      amountRange: [2000, 8000], // $20-80
    },
  ];

  const retail: VendorTemplate[] = [
    {
      name: "Amazon",
      variations: ["AMAZON.COM", "AMAZON", "AMZN", "AMAZON MARKETPLACE"],
      descriptions: ["AMAZON.COM AMZN.COM/BILL", "AMAZON MARKETPLACE", "AMZN MKTP"],
      mcc: "5969",
      categoryId: "supplies",
      amountRange: [1000, 15000], // $10-150
    },
    {
      name: "Target",
      variations: ["TARGET", "TARGET STORE", "TGT"],
      descriptions: ["TARGET STORE T-1234", "TARGET.COM", "TGT STORE"],
      mcc: "5310",
      categoryId: "supplies",
      amountRange: [1500, 10000], // $15-100
    },
    {
      name: "Best Buy",
      variations: ["BEST BUY", "BESTBUY", "BBY"],
      descriptions: ["BEST BUY STORE #123", "BESTBUY.COM", "BBY ELECTRONICS"],
      mcc: "5732",
      categoryId: "equipment",
      amountRange: [5000, 50000], // $50-500
    },
  ];

  const service: VendorTemplate[] = [
    {
      name: "Electric Company",
      variations: ["ELECTRIC COMPANY", "POWER CO", "ELECTRIC UTIL"],
      descriptions: ["MONTHLY ELECTRIC BILL", "POWER COMPANY UTIL", "ELECTRIC SERVICE"],
      mcc: "4900",
      categoryId: "utilities",
      amountRange: [8000, 25000], // $80-250
    },
    {
      name: "Gas Station",
      variations: ["SHELL", "EXXON", "CHEVRON", "BP"],
      descriptions: ["SHELL OIL STATION", "EXXON MOBIL", "CHEVRON GAS"],
      mcc: "5541",
      categoryId: "fuel",
      amountRange: [3000, 8000], // $30-80
    },
    {
      name: "Office Supply",
      variations: ["STAPLES", "OFFICE DEPOT", "OFFICEMAX"],
      descriptions: ["STAPLES OFFICE SUPPLIES", "OFFICE DEPOT STORE", "OFFICEMAX"],
      mcc: "5943",
      categoryId: "supplies",
      amountRange: [2000, 12000], // $20-120
    },
  ];

  const income: VendorTemplate[] = [
    {
      name: "Client Payment",
      variations: ["CLIENT PAYMENT", "CUSTOMER PMT", "SERVICE PAYMENT"],
      descriptions: ["PAYMENT FOR SERVICES", "CLIENT INVOICE PAYMENT", "CUSTOMER PAYMENT"],
      mcc: "6513",
      categoryId: "revenue",
      amountRange: [50000, 500000], // $500-5000 income
    },
  ];

  // Mix based on preference
  switch (mccMix) {
    case "restaurant-heavy":
      return [...restaurant, ...restaurant, ...retail, ...service, ...income];
    case "retail-heavy":
      return [...restaurant, ...retail, ...retail, ...service, ...income];
    case "balanced":
      return [...restaurant, ...retail, ...service, ...income];
    case "random":
    default:
      return [...restaurant, ...retail, ...service, ...income];
  }
}

function generateDescription(
  vendor: VendorTemplate,
  noisePercent: number,
  rng: () => number
): string {
  const baseDescription = vendor.descriptions[Math.floor(rng() * vendor.descriptions.length)]!;

  // Add noise if specified
  if (rng() * 100 < noisePercent) {
    return addNoise(baseDescription, rng);
  }

  return baseDescription;
}

function generateMerchantName(
  vendor: VendorTemplate,
  noisePercent: number,
  rng: () => number
): string {
  const baseName = vendor.variations[Math.floor(rng() * vendor.variations.length)]!;

  // Add noise if specified
  if (rng() * 100 < noisePercent) {
    return addNoise(baseName, rng);
  }

  return baseName;
}

function addNoise(text: string, rng: () => number): string {
  const noiseTypes = [
    () => text + ` #${Math.floor(rng() * 9999)}`, // Add random number
    () => text.replace(/\s/g, ""), // Remove spaces
    () => text.toUpperCase(), // Force uppercase
    () => text.toLowerCase(), // Force lowercase
    () => text + " INC", // Add corporate suffix
    () => text + " LLC", // Add corporate suffix
    () => text.split("").join(" "), // Add spaces between chars
  ];

  const noiseFunction = noiseTypes[Math.floor(rng() * noiseTypes.length)]!;
  return noiseFunction();
}

function generateAmount(categoryId: string, isExpense: boolean, rng: () => number): string {
  const baseRanges: Record<string, [number, number]> = {
    meals: [500, 5000],
    supplies: [1000, 15000],
    equipment: [5000, 50000],
    utilities: [8000, 25000],
    fuel: [3000, 8000],
    revenue: [50000, 500000],
  };

  const range = baseRanges[categoryId] || [1000, 10000];
  const [min, max] = range;
  const amount = Math.floor(min + rng() * (max - min));

  // Make expenses negative, income positive
  return isExpense && categoryId !== "revenue" ? (-amount).toString() : amount.toString();
}

function generateDate(rng: () => number): string {
  // Generate dates within the last 90 days
  const now = new Date();
  const daysAgo = Math.floor(rng() * 90);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  return date.toISOString().split("T")[0]!;
}

/**
 * Generate a specific scenario for testing
 */
export function generateScenario(scenario: "ambiguous" | "clear" | "mixed"): LabTransaction[] {
  switch (scenario) {
    case "ambiguous":
      return [
        {
          id: "amb-1",
          description: "PAYMENT THANK YOU",
          merchantName: "UNKNOWN MERCHANT",
          amountCents: "-2500",
          currency: "USD",
          categoryId: "unclear",
        },
        {
          id: "amb-2",
          description: "TRANSFER",
          amountCents: "10000",
          currency: "USD",
          categoryId: "unclear",
        },
      ];

    case "clear":
      return [
        {
          id: "clear-1",
          description: "MCDONALD'S #12345",
          merchantName: "MCDONALDS",
          mcc: "5814",
          amountCents: "-1250",
          currency: "USD",
          categoryId: "meals",
        },
        {
          id: "clear-2",
          description: "ELECTRIC COMPANY MONTHLY BILL",
          merchantName: "ELECTRIC UTILITY",
          mcc: "4900",
          amountCents: "-15000",
          currency: "USD",
          categoryId: "utilities",
        },
      ];

    case "mixed":
    default:
      return [...generateScenario("clear"), ...generateScenario("ambiguous")];
  }
}
