// app/api/receipts/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { captureException } from "@nexus/analytics";

/**
 * Helper to get authenticated user
 */
async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createServerClient();
  
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  return {
    userId: user.id,
    userEmail: user.email,
  };
}

/**
 * GET /api/receipts/download
 * Download a receipt file from storage
 */
export async function GET(request: NextRequest) {
  try {
    console.log("GET /api/receipts/download - Starting download");

    // Get authenticated user
    let userId: string;
    try {
      const context = await getAuthenticatedUser(request);
      userId = context.userId;
      console.log("User authenticated:", userId);
    } catch (authError) {
      console.error("Authentication error:", authError);
      return NextResponse.json(
        { 
          success: false, 
          error: authError instanceof Error ? authError.message : "Authentication failed" 
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");

    if (!filePath) {
      console.error("No file path provided");
      return NextResponse.json(
        { success: false, error: "File path is required" },
        { status: 400 }
      );
    }

    console.log("Requested file path:", filePath);

    const supabase = await createServerClient();

    // Verify the file belongs to this user
    const { data: receipt, error: fetchError } = await supabase
      .from("receipts")
      .select("id, uploaded_by, file_path, file_name, mime_type")
      .eq("file_path", filePath)
      .eq("uploaded_by", userId)
      .single();

    if (fetchError || !receipt) {
      console.error("Receipt not found or access denied:", fetchError);
      return NextResponse.json(
        { success: false, error: "Receipt not found or access denied" },
        { status: 404 }
      );
    }

    console.log("Receipt found:", {
      id: receipt.id,
      fileName: receipt.file_name,
      mimeType: receipt.mime_type,
    });

    // Get public URL and redirect (simpler approach)
    const { data: urlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      console.error("Failed to get public URL for file");
      return NextResponse.json(
        { success: false, error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    console.log("Redirecting to public URL:", urlData.publicUrl);

    // Redirect to the public URL with download disposition
    return NextResponse.redirect(urlData.publicUrl);
  } catch (error) {
    console.error("Error in GET /api/receipts/download:", error);
    
    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown download error")
      );
    } catch (e) {
      console.error("Failed to capture exception:", e);
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}   