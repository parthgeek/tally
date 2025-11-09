import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userOrgRole } = await supabase
      .from("user_org_roles")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!userOrgRole) {
      return Response.json({ error: "No organization" }, { status: 400 });
    }

    const orgId = userOrgRole.org_id;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d"; // 7d, 30d, 90d, 1y

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case "7d": startDate.setDate(now.getDate() - 7); break;
      case "30d": startDate.setDate(now.getDate() - 30); break;
      case "90d": startDate.setDate(now.getDate() - 90); break;
      case "1y": startDate.setFullYear(now.getFullYear() - 1); break;
      default: startDate.setDate(now.getDate() - 30);
    }

    // Get sales summary
    const { data: summary, error: summaryError } = await supabase
      .from("sales_to_refunds")
      .select(`
        sales_gross,
        discounts,
        shipping_income,
        tax_collected,
        refunds_total,
        net_sales_after_refunds,
        created_at
      `)
      .eq("org_id", orgId)
      .gte("created_at", startDate.toISOString());

    if (summaryError) {
      return Response.json({ error: summaryError.message }, { status: 500 });
    }

    // Calculate totals
    const totals = summary?.reduce((acc, order) => ({
      totalSales: acc.totalSales + (order.sales_gross || 0),
      totalDiscounts: acc.totalDiscounts + (order.discounts || 0),
      totalShipping: acc.totalShipping + (order.shipping_income || 0),
      totalTax: acc.totalTax + (order.tax_collected || 0),
      totalRefunds: acc.totalRefunds + (order.refunds_total || 0),
      totalNet: acc.totalNet + (order.net_sales_after_refunds || 0),
      orderCount: acc.orderCount + 1,
    }), {
      totalSales: 0,
      totalDiscounts: 0,
      totalShipping: 0,
      totalTax: 0,
      totalRefunds: 0,
      totalNet: 0,
      orderCount: 0,
    });

    // Daily breakdown for charts
    const dailyData = summary?.reduce((acc: any, order) => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          sales: 0,
          refunds: 0,
          net: 0,
          orders: 0,
        };
      }
      acc[date].sales += order.sales_gross || 0;
      acc[date].refunds += order.refunds_total || 0;
      acc[date].net += order.net_sales_after_refunds || 0;
      acc[date].orders += 1;
      return acc;
    }, {});

    const dailyArray = Object.values(dailyData || {}).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return Response.json({
      summary: totals,
      dailyBreakdown: dailyArray,
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    });
  } catch (error) {
    return Response.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}