/**
 * Mock data generators for landing page visuals
 * Deterministic and stable for consistent display
 */

// Generate realistic profit series
export function generateProfitSeries(points: number = 30): number[] {
  const series: number[] = [];
  let value = 45000; // Start at $45k
  
  for (let i = 0; i < points; i++) {
    // Random walk with slight upward bias
    const change = (Math.random() - 0.45) * 2000;
    value = Math.max(35000, Math.min(55000, value + change));
    series.push(Math.round(value));
  }
  
  return series;
}

// Mock transactions for categorization visual
export const mockTransactions = [
  {
    id: "1",
    vendor: "Amazon Web Services",
    amount: -342.50,
    date: "2025-01-28",
    category: "Software & Subscriptions",
    corrected: false,
  },
  {
    id: "2",
    vendor: "FedEx Shipping",
    amount: -127.85,
    date: "2025-01-27",
    category: "Shipping & Fulfillment",
    corrected: true,
    previousCategory: "Office Supplies",
  },
  {
    id: "3",
    vendor: "Shopify Inc.",
    amount: -79.00,
    date: "2025-01-26",
    category: "Software & Subscriptions",
    corrected: false,
  },
];

// Mock payout breakdown for Shopify reconciliation
export const mockPayoutBreakdown = {
  total: 12430.22,
  segments: [
    { label: "Net Revenue", value: 11234.50, color: "hsl(var(--primary))" },
    { label: "Fees", value: 892.15, color: "hsl(var(--warning))" },
    { label: "Refunds", value: 303.57, color: "hsl(var(--destructive))" },
  ],
};

// Mock receipt thumbnails
export const mockReceipts = [
  { id: "1", name: "receipt_001.pdf", size: "124 KB", type: "PDF" },
  { id: "2", name: "receipt_002.jpg", size: "89 KB", type: "JPG" },
];

// Export providers
export const exportProviders = [
  { id: "quickbooks", label: "QuickBooks", checked: true },
  { id: "xero", label: "Xero", checked: true },
  { id: "csv", label: "CSV", checked: false },
];

