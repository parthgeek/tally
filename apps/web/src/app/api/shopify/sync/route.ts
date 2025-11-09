import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createClient(request: NextRequest) {
  const cookieStore = cookies();
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

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(request);
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
    const body = await request.json();
    const { syncMode = "incremental" } = body;

    const { data: shopConnection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .maybeSingle();

    if (!shopConnection) {
      return Response.json(
        { error: "No Shopify connection" },
        { status: 400 }
      );
    }

    const now = new Date();
    const startDate =
      syncMode === "full"
        ? new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
        : new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const shopDomain = shopConnection.shop_domain;
    const accessToken = shopConnection.access_token;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-10";

    const query = `
      query getOrders($query: String!, $cursor: String) {
        orders(first: 250, query: $query, after: $cursor) {
          edges {
            node {
              id
              name
              createdAt
              currencyCode
              subtotalPriceSet { shopMoney { amount } }
              totalDiscountsSet { shopMoney { amount } }
              totalShippingPriceSet { shopMoney { amount } }
              totalTaxSet { shopMoney { amount } }
              refunds {
                id
                createdAt
                totalRefundedSet { shopMoney { amount } }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    let hasNextPage = true;
    let cursor: string | null = null;
    let totalOrders = 0;
    const ordersToUpsert: any[] = [];

    while (hasNextPage && ordersToUpsert.length < 2500) {
      const variables: any = {
        query: `created_at:>='${startDate.toISOString()}'`,
      };
      if (cursor) variables.cursor = cursor;

      const response = await fetch(
        `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({ query, variables }),
        }
      );

      if (!response.ok) {
        return Response.json(
          { error: "Shopify API error" },
          { status: 502 }
        );
      }

      const data = await response.json();
      const orders = data.data?.orders?.edges || [];
      const pageInfo = data.data?.orders?.pageInfo;

      for (const { node: order } of orders) {
        const refundsTotal = order.refunds.reduce(
          (sum: number, r: any) =>
            sum + parseFloat(r.totalRefundedSet.shopMoney.amount),
          0
        );

        const salesGross = parseFloat(order.subtotalPriceSet.shopMoney.amount);
        const discounts = parseFloat(order.totalDiscountsSet.shopMoney.amount);
        const shipping = parseFloat(order.totalShippingPriceSet.shopMoney.amount);
        const tax = parseFloat(order.totalTaxSet.shopMoney.amount);

        ordersToUpsert.push({
          org_id: orgId,
          shop_order_id: order.id,
          order_name: order.name,
          created_at: order.createdAt,
          currency: order.currencyCode,
          sales_gross: salesGross,
          discounts: discounts,
          shipping_income: shipping,
          tax_collected: tax,
          refunds_total: refundsTotal,
          refunds_detail: order.refunds,
          net_sales_after_refunds: salesGross - discounts - refundsTotal,
          raw: order,
          updated_at: new Date().toISOString(),
        });

        totalOrders++;
      }

      hasNextPage = pageInfo?.hasNextPage || false;
      cursor = pageInfo?.endCursor || null;
    }

    // Batch upsert
    for (let i = 0; i < ordersToUpsert.length; i += 100) {
      await supabase
        .from("sales_to_refunds")
        .upsert(ordersToUpsert.slice(i, i + 100), {
          onConflict: "org_id,shop_order_id",
        });
    }

    // Update sync state
    await supabase
      .from("shopify_connections")
      .update({
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);

    return Response.json({
      success: true,
      ordersCount: totalOrders,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return Response.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(request);
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
      return Response.json({
        connected: false,
        needsSetup: true,
      });
    }

    const orgId = userOrgRole.org_id;

    const { data: shopConnection } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .maybeSingle();

    if (!shopConnection) {
      return Response.json({ connected: false });
    }

    const { count: ordersCount } = await supabase
      .from("sales_to_refunds")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId);

    return Response.json({
      connected: true,
      shopDomain: shopConnection.shop_domain,
      lastSyncedAt: shopConnection.last_synced_at,
      ordersCount: ordersCount || 0,
    });
  } catch (error) {
    return Response.json({ error: "Failed to get status" }, { status: 500 });
  }
}