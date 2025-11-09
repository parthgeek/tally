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

// GET - Read sales data with filters
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
    
    // Build query with filters
    let query = supabase
      .from("sales_to_refunds")
      .select("*")
      .eq("org_id", orgId);

    // Date range filter
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    // Order by
    const orderBy = searchParams.get("order_by") || "created_at";
    const orderDirection = searchParams.get("order_dir") || "desc";
    query = query.order(orderBy, { ascending: orderDirection === "asc" });

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return Response.json({ error: "Failed to fetch sales data" }, { status: 500 });
  }
}

// DELETE - Delete sales data
export async function DELETE(request: NextRequest) {
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
    const orderId = searchParams.get("order_id");

    if (!orderId) {
      return Response.json({ error: "Order ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("sales_to_refunds")
      .delete()
      .eq("org_id", orgId)
      .eq("shop_order_id", orderId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, message: "Order deleted" });
  } catch (error) {
    return Response.json({ error: "Failed to delete order" }, { status: 500 });
  }
}