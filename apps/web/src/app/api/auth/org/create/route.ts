import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  orgCreateRequestSchema,
  type OrgCreateRequest,
  type OrgCreateResponse,
  type OrgId,
} from "@nexus/types/contracts";
import { createErrorResponse, createValidationErrorResponse } from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const cookieStore = await cookies();

    // Check authentication using the regular client
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse("Unauthorized", 401);
    }

    // Create a service role client for database operations that require elevated privileges
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse and validate request body
    const body = await request.json();
    let validatedRequest: OrgCreateRequest;

    try {
      validatedRequest = orgCreateRequestSchema.parse(body);
    } catch (error) {
      return createValidationErrorResponse(error);
    }

    // Insert into orgs table and capture generated org_id
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from("orgs")
      .insert({
        name: validatedRequest.name,
        industry: validatedRequest.industry,
        timezone: validatedRequest.timezone,
        owner_user_id: user.id,
      })
      .select("id")
      .single();

    if (orgError || !orgData) {
      console.error("Error creating organization:", orgError);
      return createErrorResponse("Failed to create organization", 500);
    }

    const orgId = orgData.id as OrgId;

    // Insert into user_org_roles with role 'owner'
    const { error: roleError } = await supabaseAdmin.from("user_org_roles").insert({
      user_id: user.id,
      org_id: orgId,
      role: "owner",
    });

    if (roleError) {
      console.error("Error creating user org role:", roleError);
      return createErrorResponse("Failed to set organization ownership", 500);
    }

    // Seed org categories: copy global defaults into org_categories for the new org_id
    const { data: globalCategories, error: categoriesError } = await supabaseAdmin
      .from("categories")
      .select("id, name, parent_id")
      .is("org_id", null);

    if (categoriesError) {
      console.error("Error fetching global categories:", categoriesError);
      return createErrorResponse("Failed to seed categories", 500);
    }

    if (globalCategories && globalCategories.length > 0) {
      // Create mapping of global category IDs to new org-specific category IDs
      const categoryMapping: Record<string, string> = {};

      // First pass: insert root categories (no parent)
      const rootCategories = globalCategories.filter((cat) => !cat.parent_id);

      for (const category of rootCategories) {
        const { data: insertedCategory, error: insertError } = await supabaseAdmin
          .from("categories")
          .insert({
            org_id: orgId,
            name: category.name,
            parent_id: null,
          })
          .select("id")
          .single();

        if (!insertError && insertedCategory) {
          categoryMapping[category.id] = insertedCategory.id;
        }
      }

      // Second pass: insert child categories with parent references
      const childCategories = globalCategories.filter((cat) => cat.parent_id);

      for (const category of childCategories) {
        const parentId = category.parent_id ? categoryMapping[category.parent_id] : null;

        const { data: insertedChildCategory, error: childInsertError } = await supabaseAdmin
          .from("categories")
          .insert({
            org_id: orgId,
            name: category.name,
            parent_id: parentId,
          })
          .select("id")
          .single();

        if (!childInsertError && insertedChildCategory) {
          categoryMapping[category.id] = insertedChildCategory.id;
        }
      }
    }

    // Set orgId cookie for subsequent requests
    cookieStore.set("orgId", orgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    const response: OrgCreateResponse = {
      orgId,
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/auth/org/create:", error);
    return createErrorResponse("Internal server error", 500);
  }
}
