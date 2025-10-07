import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  withOrgFromRequest,
  createValidationErrorResponse,
  createErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";

const updateThresholdsSchema = z.object({
  lowBalanceThresholdCents: z.string().regex(/^\d+$/, "Must be a valid cents amount"),
});

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await withOrgFromRequest(request);
    const supabase = await createServerClient();

    // Get current thresholds
    const { data: org, error } = await supabase
      .from("orgs")
      .select("low_balance_threshold_cents")
      .eq("id", orgId)
      .single();

    if (error || !org) {
      return createErrorResponse("Organization not found", 404);
    }

    return Response.json({
      lowBalanceThresholdCents: org.low_balance_threshold_cents || "100000", // Default $1000
    });
  } catch (error) {
    console.error("Thresholds GET error:", error);

    if (error instanceof Response) {
      return error;
    }

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { orgId } = await withOrgFromRequest(request);

    // Parse and validate request body
    const body = await request.json();
    let validatedRequest;
    try {
      validatedRequest = updateThresholdsSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    const supabase = await createServerClient();

    // Update organization thresholds
    const { error: updateError } = await supabase
      .from("orgs")
      .update({
        low_balance_threshold_cents: validatedRequest.lowBalanceThresholdCents,
      })
      .eq("id", orgId);

    if (updateError) {
      console.error("Failed to update thresholds:", updateError);
      return createErrorResponse("Failed to update thresholds", 500);
    }

    return Response.json({
      success: true,
      message: "Thresholds updated successfully",
    });
  } catch (error) {
    console.error("Thresholds PUT error:", error);

    if (error instanceof Response) {
      return error;
    }

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
