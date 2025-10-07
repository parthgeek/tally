import type { NextRequest } from "next/server";
import { withOrgFromRequest } from "@/lib/api/with-org";
import { DashboardService } from "@/lib/services/dashboard-service";

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await withOrgFromRequest(request);
    const dashboardService = await DashboardService.create();

    const dashboard = await dashboardService.getDashboardData(orgId);

    return Response.json(dashboard, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    if (error instanceof Response) {
      return error;
    }

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
