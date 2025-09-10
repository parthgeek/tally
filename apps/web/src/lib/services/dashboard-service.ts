import { createServerClient } from "@/lib/supabase";
import { sumCents, pctDelta, zScore } from "@nexus/shared";
import type { DashboardDTO, OrgId } from "@nexus/types/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";

interface TimeWindows {
  today: string;
  d30_from: string;
  d90_from: string;
  prev30_from: string;
  prev30_to: string;
}

interface CashMetrics {
  cashOnHandCents: string;
  safeToSpend14Cents: string;
}

interface InflowOutflowMetrics {
  d30: {
    inflowCents: string;
    outflowCents: string;
    dailyAvgInflowCents: string;
    dailyAvgOutflowCents: string;
  };
  d90: {
    inflowCents: string;
    outflowCents: string;
  };
}

interface TopExpense {
  categoryId: string;
  name: string;
  cents: string;
}

interface CategoryJoin {
  name: string;
}

interface TransactionWithCategory {
  category_id: string | null;
  amount_cents: string;
  categories: CategoryJoin | null;
}

// Type for the actual query result with any types from Supabase
interface RawTransactionWithCategory {
  category_id: any;
  amount_cents: any;
  categories: any;
}

interface AlertMetrics {
  lowBalance: boolean;
  unusualSpend: boolean;
  needsReviewCount: number;
}

interface TransactionWithDetails {
  amount_cents: string;
  description?: string;
  merchant_name?: string;
  categories?: {
    name: string;
  } | null;
}

interface RawTransactionWithDetails {
  amount_cents: any;
  description: any;
  merchant_name: any;
  categories: {
    name: any;
  }[];
}

export class DashboardService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createServerClient();
    return new DashboardService(supabase);
  }

  private calculateTimeWindows(): TimeWindows {
    const today = new Date();
    const d30_from = new Date(today);
    d30_from.setDate(d30_from.getDate() - 30);
    const d90_from = new Date(today);
    d90_from.setDate(d90_from.getDate() - 90);
    const prev30_from = new Date(today);
    prev30_from.setDate(prev30_from.getDate() - 60);
    const prev30_to = new Date(today);
    prev30_to.setDate(prev30_to.getDate() - 30);

    const formatDate = (date: Date): string => date.toISOString().split('T')[0] || '';

    const formattedToday = formatDate(today);
    const formattedD30From = formatDate(d30_from);
    const formattedD90From = formatDate(d90_from);
    const formattedPrev30From = formatDate(prev30_from);
    const formattedPrev30To = formatDate(prev30_to);

    return {
      today: formattedToday,
      d30_from: formattedD30From,
      d90_from: formattedD90From,
      prev30_from: formattedPrev30From,
      prev30_to: formattedPrev30To,
    };
  }

  async getCashMetrics(orgId: OrgId): Promise<CashMetrics> {
    // Get liquid account balances
    const { data: accounts } = await this.supabase
      .from('accounts')
      .select('current_balance_cents')
      .eq('org_id', orgId)
      .in('type', ['checking', 'savings', 'cash'])
      .eq('is_active', true);

    const cashOnHandCents = sumCents(
      (accounts || []).map((a: { current_balance_cents: string | null }) => a.current_balance_cents || '0')
    );

    // For safe-to-spend, we need daily averages which we'll calculate in getInflowOutflow
    // This is a placeholder - we'll calculate it in the main function
    return {
      cashOnHandCents,
      safeToSpend14Cents: '0', // Will be calculated later with inflow/outflow data
    };
  }

  async getInflowOutflowMetrics(orgId: OrgId, windows: TimeWindows): Promise<InflowOutflowMetrics> {
    // Get 30d transactions
    const { data: transactions30 } = await this.supabase
      .from('transactions')
      .select('amount_cents')
      .eq('org_id', orgId)
      .gte('date', windows.d30_from)
      .lte('date', windows.today);

    // Get 90d transactions
    const { data: transactions90 } = await this.supabase
      .from('transactions')
      .select('amount_cents')
      .eq('org_id', orgId)
      .gte('date', windows.d90_from)
      .lte('date', windows.today);

    // Calculate 30d metrics
    const inflow30 = sumCents(
      (transactions30 || [])
        .filter((t: { amount_cents: string | null }) => BigInt(t.amount_cents || '0') > BigInt(0))
        .map((t: { amount_cents: string | null }) => t.amount_cents || '0')
    );
    const outflow30 = sumCents(
      (transactions30 || [])
        .filter((t: { amount_cents: string | null }) => BigInt(t.amount_cents || '0') < BigInt(0))
        .map((t: { amount_cents: string | null }) => (BigInt(t.amount_cents || '0') * -BigInt(1)).toString())
    );

    // Calculate 90d metrics
    const inflow90 = sumCents(
      (transactions90 || [])
        .filter((t: { amount_cents: string | null }) => BigInt(t.amount_cents || '0') > BigInt(0))
        .map((t: { amount_cents: string | null }) => t.amount_cents || '0')
    );
    const outflow90 = sumCents(
      (transactions90 || [])
        .filter((t: { amount_cents: string | null }) => BigInt(t.amount_cents || '0') < BigInt(0))
        .map((t: { amount_cents: string | null }) => (BigInt(t.amount_cents || '0') * -BigInt(1)).toString())
    );

    // Calculate daily averages for 30d
    const dailyAvgInflow30 = (BigInt(inflow30) / BigInt(30)).toString();
    const dailyAvgOutflow30 = (BigInt(outflow30) / BigInt(30)).toString();

    return {
      d30: {
        inflowCents: inflow30,
        outflowCents: outflow30,
        dailyAvgInflowCents: dailyAvgInflow30,
        dailyAvgOutflowCents: dailyAvgOutflow30,
      },
      d90: {
        inflowCents: inflow90,
        outflowCents: outflow90,
      },
    };
  }

  async getTopExpenses(orgId: OrgId, windows: TimeWindows): Promise<TopExpense[]> {
    const { data: categoryExpenses } = await this.supabase
      .from('transactions')
      .select(`
        category_id,
        amount_cents,
        categories(name)
      `)
      .eq('org_id', orgId)
      .gte('date', windows.d30_from)
      .lte('date', windows.today)
      .lt('amount_cents', '0'); // Only expenses (negative amounts)

    const categoryTotals = new Map<string, { name: string; cents: string }>();
    
    for (const tx of (categoryExpenses || []) as RawTransactionWithCategory[]) {
      const categoryId = String(tx.category_id || 'uncategorized');
      const categoryName = String(tx.categories?.name || 'Uncategorized');
      const absAmount = (BigInt(String(tx.amount_cents || '0')) * -BigInt(1)).toString();
      
      if (categoryTotals.has(categoryId)) {
        const existing = categoryTotals.get(categoryId)!;
        existing.cents = sumCents([existing.cents, absAmount]);
      } else {
        categoryTotals.set(categoryId, { name: categoryName, cents: absAmount });
      }
    }

    return Array.from(categoryTotals.entries())
      .map(([categoryId, data]) => ({ categoryId, ...data }))
      .sort((a, b) => Number(BigInt(b.cents) - BigInt(a.cents)))
      .slice(0, 5);
  }

  async getTrendMetrics(orgId: OrgId, windows: TimeWindows, currentOutflow: string): Promise<{ outflowDeltaPct: number }> {
    const { data: prevTransactions } = await this.supabase
      .from('transactions')
      .select('amount_cents')
      .eq('org_id', orgId)
      .gte('date', windows.prev30_from)
      .lt('date', windows.prev30_to);

    const prevOutflow30 = sumCents(
      (prevTransactions || [])
        .filter((t: { amount_cents: string | null }) => BigInt(t.amount_cents || '0') < BigInt(0))
        .map((t: { amount_cents: string | null }) => (BigInt(t.amount_cents || '0') * -BigInt(1)).toString())
    );

    const outflowDeltaPct = pctDelta(
      Number(BigInt(currentOutflow)) / 100, // Convert to dollars for calculation
      Number(BigInt(prevOutflow30)) / 100
    );

    return { outflowDeltaPct };
  }

  async getAlertMetrics(orgId: OrgId, cashOnHandCents: string): Promise<AlertMetrics> {
    // Get org threshold
    const { data: orgData } = await this.supabase
      .from('orgs')
      .select('low_balance_threshold_cents')
      .eq('id', orgId)
      .single();

    const thresholdCents = orgData?.low_balance_threshold_cents || '100000';
    const lowBalance = BigInt(cashOnHandCents) < BigInt(thresholdCents);

    // Get needs review count
    const { count: needsReviewCount } = await this.supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('needs_review', true);

    // Calculate unusual spend using weekly data
    const unusualSpend = await this.calculateUnusualSpend(orgId);

    return {
      lowBalance,
      unusualSpend,
      needsReviewCount: needsReviewCount || 0,
    };
  }

  private async calculateUnusualSpend(orgId: OrgId): Promise<boolean> {
    const { data: weeklyData } = await this.supabase
      .from('transactions')
      .select('amount_cents, date')
      .eq('org_id', orgId)
      .gte('date', new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // 12 weeks
      .lt('amount_cents', '0');

    // Group by week and calculate outflows
    const weeklyOutflows: number[] = [];
    const weekMap = new Map<string, string[]>();
    
    for (const tx of weeklyData || []) {
      if (!tx.date || !tx.amount_cents) continue;
      
      const date = new Date(tx.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week
      const weekKey = weekStart.toISOString().split('T')[0] || '';
      
      if (weekKey && !weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      if (weekKey) {
        weekMap.get(weekKey)!.push((BigInt(tx.amount_cents) * -BigInt(1)).toString());
      }
    }

    // Convert to weekly totals (excluding current week)
    const sortedWeeks = Array.from(weekMap.keys()).sort();
    const currentWeek = sortedWeeks[sortedWeeks.length - 1];
    
    for (const [week, amounts] of weekMap.entries()) {
      if (week !== currentWeek) { // Exclude current week from baseline
        const weekTotal = Number(BigInt(sumCents(amounts))) / 100; // Convert to dollars
        weeklyOutflows.push(weekTotal);
      }
    }

    // Calculate z-score for current week if we have data
    if (currentWeek && weekMap.has(currentWeek) && weeklyOutflows.length >= 4) {
      const currentWeekTotal = Number(BigInt(sumCents(weekMap.get(currentWeek)!))) / 100;
      const zScoreValue = zScore(currentWeekTotal, weeklyOutflows);
      return Math.abs(zScoreValue) > 2; // More than 2 standard deviations
    }

    return false;
  }

  private async calculateSafeToSpend(
    orgId: OrgId,
    cashOnHandCents: string, 
    dailyAvgInflowCents: string, 
    dailyAvgOutflowCents: string,
    windows: TimeWindows
  ): Promise<string> {
    // Get estimated fixed costs for next 14 days
    const reservedFixed14Cents = await this.estimateFixedCosts14d(orgId, windows);

    return (
      BigInt(cashOnHandCents) + 
      (BigInt(dailyAvgInflowCents) * BigInt(14)) - 
      (BigInt(dailyAvgOutflowCents) * BigInt(14)) -
      BigInt(reservedFixed14Cents)
    ).toString();
  }

  private async estimateFixedCosts14d(orgId: OrgId, windows: TimeWindows): Promise<string> {
    try {
      // Get transactions from last 30 days that match fixed cost patterns
      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select(`
          amount_cents,
          description,
          merchant_name,
          categories!inner(name)
        `)
        .eq('org_id', orgId)
        .gte('date', windows.d30_from)
        .lte('date', windows.today)
        .lt('amount_cents', 0); // Outflows only

      if (error || !transactions) {
        return '0'; // Gracefully degrade to v0 behavior
      }

      // Fixed cost patterns (case-insensitive)
      const fixedCostPatterns = [
        // Rent/Mortgage
        /\b(rent|lease|mortgage|landlord|property)\b/i,
        // Utilities
        /\b(electric|gas|water|sewer|internet|phone|cell|mobile|utility|utilities)\b/i,
        // Insurance
        /\b(insurance|premium)\b/i,
        // Software/Subscriptions
        /\b(subscription|software|saas|license|adobe|microsoft|google|aws|hosting)\b/i,
        // Loan payments
        /\b(loan|payment|financing|credit)\b/i,
      ];

      const categoryPatterns = [
        /\b(rent|utilities|insurance|software|subscription|loan)\b/i,
      ];

      const fixedCostTransactions = (transactions as RawTransactionWithDetails[]).filter((tx: RawTransactionWithDetails) => {
        const description = String(tx.description || '').toLowerCase();
        const merchantName = String(tx.merchant_name || '').toLowerCase();
        const categoryName = String(tx.categories?.[0]?.name || '').toLowerCase();

        // Check against description and merchant name patterns
        const matchesPattern = fixedCostPatterns.some(pattern => 
          pattern.test(description) || pattern.test(merchantName)
        );

        // Check against category patterns
        const matchesCategory = categoryPatterns.some(pattern =>
          pattern.test(categoryName)
        );

        return matchesPattern || matchesCategory;
      });

      if (fixedCostTransactions.length === 0) {
        return '0'; // No fixed costs detected
      }

      // Calculate total fixed costs from last 30 days
      const totalFixed30d = sumCents(
        fixedCostTransactions.map((tx: RawTransactionWithDetails) => Math.abs(parseInt(String(tx.amount_cents))).toString())
      );

      // Estimate 14-day fixed costs (roughly half of 30-day)
      const estimated14d = Math.round(parseInt(totalFixed30d) * 14 / 30);

      return estimated14d.toString();

    } catch (error) {
      console.error('Error estimating fixed costs:', error);
      return '0'; // Gracefully degrade to v0 behavior
    }
  }

  async getDashboardData(orgId: OrgId): Promise<DashboardDTO> {
    const windows = this.calculateTimeWindows();
    
    // Get all metrics
    const [cashMetrics, inflowOutflowMetrics, topExpenses] = await Promise.all([
      this.getCashMetrics(orgId),
      this.getInflowOutflowMetrics(orgId, windows),
      this.getTopExpenses(orgId, windows),
    ]);

    // Calculate safe-to-spend with daily averages and fixed cost estimation
    const safeToSpend14Cents = await this.calculateSafeToSpend(
      orgId,
      cashMetrics.cashOnHandCents,
      inflowOutflowMetrics.d30.dailyAvgInflowCents,
      inflowOutflowMetrics.d30.dailyAvgOutflowCents,
      windows
    );

    // Get trend and alerts
    const [trendMetrics, alertMetrics] = await Promise.all([
      this.getTrendMetrics(orgId, windows, inflowOutflowMetrics.d30.outflowCents),
      this.getAlertMetrics(orgId, cashMetrics.cashOnHandCents),
    ]);

    return {
      cashOnHandCents: cashMetrics.cashOnHandCents,
      safeToSpend14Cents,
      inflowOutflow: inflowOutflowMetrics,
      topExpenses30: topExpenses,
      trend: trendMetrics,
      alerts: alertMetrics,
      generatedAt: new Date().toISOString(),
    };
  }
}