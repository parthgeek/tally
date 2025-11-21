// app/api/receipts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { captureException } from "@nexus/analytics";
import { getPosthogClientServer } from "@nexus/analytics/server";

/**
 * Helper to get authenticated user
 */
async function getAuthenticatedUser(request: NextRequest) {
  const supabase = await createServerClient();
  
  // Get authenticated user
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
 * GET /api/receipts
 * Fetch all receipts for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuthenticatedUser(request);
    const supabase = await createServerClient();

    const { data: receipts, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("uploaded_by", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch receipts:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch receipts", receipts: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      receipts: receipts || [],
    });
  } catch (error) {
    console.error("Error in GET /api/receipts:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("required") ? 401 : 500;

    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown fetch error")
      );
    } catch (e) {
      console.error("Failed to capture exception:", e);
    }

    return NextResponse.json(
      { success: false, error: errorMessage, receipts: [] },
      { status: statusCode }
    );
  }
}

/**
 * POST /api/receipts
 * Upload a new receipt file
 */
export async function POST(request: NextRequest) {
  try {
    console.log("POST /api/receipts - Starting upload");

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

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error("Failed to parse form data:", error);
      return NextResponse.json(
        { success: false, error: "Invalid form data" },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File;
    if (!file) {
      console.error("No file provided in form data");
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    console.log("File received:", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      console.error("Invalid file type:", file.type);
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type. Allowed: ${allowedTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      console.error("File too large:", file.size);
      return NextResponse.json(
        { success: false, error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "unknown";
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const storagePath = `${userId}/${year}/${month}/${fileName}`;

    console.log("Storage path:", storagePath);

    const supabase = await createServerClient();

    // Upload to Supabase Storage
    let uploadData;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uploadResult = await supabase.storage
        .from("receipts")
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadResult.error) {
        console.error("Storage upload error:", uploadResult.error);
        return NextResponse.json(
          {
            success: false,
            error: `Upload failed: ${uploadResult.error.message}`,
          },
          { status: 500 }
        );
      }

      uploadData = uploadResult.data;
      console.log("File uploaded to storage:", uploadData.path);
    } catch (error) {
      console.error("Failed to upload file to storage:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to upload file to storage",
        },
        { status: 500 }
      );
    }

    // Create receipt record in database (org_id can be null)
    let receiptRecord;
    try {
      const insertResult = await supabase
        .from("receipts")
        .insert({
          uploaded_by: userId,
          file_path: uploadData.path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          processing_status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertResult.error) {
        console.error("Database insert error:", insertResult.error);

        // Clean up uploaded file if database insert fails
        try {
          await supabase.storage.from("receipts").remove([uploadData.path]);
          console.log("Cleaned up uploaded file after DB error");
        } catch (cleanupError) {
          console.error("Failed to clean up uploaded file:", cleanupError);
        }

        return NextResponse.json(
          {
            success: false,
            error: `Failed to save receipt: ${insertResult.error.message}`,
          },
          { status: 500 }
        );
      }

      receiptRecord = insertResult.data;
      console.log("Receipt record created:", receiptRecord.id);
    } catch (error) {
      console.error("Failed to create receipt record:", error);

      // Clean up uploaded file
      try {
        await supabase.storage.from("receipts").remove([uploadData.path]);
      } catch (cleanupError) {
        console.error("Failed to clean up:", cleanupError);
      }

      return NextResponse.json(
        { success: false, error: "Failed to save receipt" },
        { status: 500 }
      );
    }

    // Track analytics event
    try {
      const posthog = await getPosthogClientServer();
      if (posthog) {
        await posthog.capture({
          distinctId: userId,
          event: "receipt_uploaded",
          properties: {
            user_id: userId,
            receipt_id: receiptRecord.id,
            file_type: file.type,
            file_size: file.size,
            file_extension: fileExt,
          },
        });
      }
    } catch (analyticsError) {
      console.error("Failed to capture analytics:", analyticsError);
    }

    console.log("Upload complete:", receiptRecord.id);

    return NextResponse.json({
      success: true,
      receipt: receiptRecord,
      message: "Receipt uploaded successfully",
    });
  } catch (error) {
    console.error("Error in POST /api/receipts:", error);
    
    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown upload error")
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

/**
 * PATCH /api/receipts
 * Update receipt metadata
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await getAuthenticatedUser(request);

    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { id, description, amount, date, vendor, category } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Receipt ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Verify receipt belongs to user
    const { data: existingReceipt, error: fetchError } = await supabase
      .from("receipts")
      .select("id, uploaded_by")
      .eq("id", id)
      .eq("uploaded_by", userId)
      .single();

    if (fetchError || !existingReceipt) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Update receipt
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount;
    if (date !== undefined) updateData.date = date;
    if (vendor !== undefined) updateData.vendor = vendor;
    if (category !== undefined) updateData.category = category;

    const { data: updatedReceipt, error: updateError } = await supabase
      .from("receipts")
      .update(updateData)
      .eq("id", id)
      .eq("uploaded_by", userId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update receipt:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update receipt" },
        { status: 500 }
      );
    }

    // Track analytics
    try {
      const posthog = await getPosthogClientServer();
      if (posthog) {
        await posthog.capture({
          distinctId: userId,
          event: "receipt_updated",
          properties: {
            user_id: userId,
            receipt_id: id,
          },
        });
      }
    } catch (analyticsError) {
      console.error("Failed to capture analytics:", analyticsError);
    }

    return NextResponse.json({
      success: true,
      receipt: updatedReceipt,
      message: "Receipt updated successfully",
    });
  } catch (error) {
    console.error("Error in PATCH /api/receipts:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("required") ? 401 : 500;
    
    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown update error")
      );
    } catch (e) {
      console.error("Failed to capture exception:", e);
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

/**
 * DELETE /api/receipts
 * Delete a receipt and its file
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Receipt ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Fetch receipt to get file path and verify ownership
    const { data: receipt, error: fetchError } = await supabase
      .from("receipts")
      .select("id, uploaded_by, file_path")
      .eq("id", id)
      .eq("uploaded_by", userId)
      .single();

    if (fetchError || !receipt) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Delete from storage
    try {
      const { error: storageError } = await supabase.storage
        .from("receipts")
        .remove([receipt.file_path]);

      if (storageError) {
        console.error("Failed to delete file from storage:", storageError);
        // Continue with database deletion even if storage delete fails
      }
    } catch (storageError) {
      console.error("Error deleting from storage:", storageError);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("receipts")
      .delete()
      .eq("id", id)
      .eq("uploaded_by", userId);

    if (deleteError) {
      console.error("Failed to delete receipt from database:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete receipt" },
        { status: 500 }
      );
    }

    // Track analytics
    try {
      const posthog = await getPosthogClientServer();
      if (posthog) {
        await posthog.capture({
          distinctId: userId,
          event: "receipt_deleted",
          properties: {
            user_id: userId,
            receipt_id: id,
          },
        });
      }
    } catch (analyticsError) {
      console.error("Failed to capture analytics:", analyticsError);
    }

    return NextResponse.json({
      success: true,
      message: "Receipt deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/receipts:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const statusCode = errorMessage.includes("required") ? 401 : 500;
    
    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown delete error")
      );
    } catch (e) {
      console.error("Failed to capture exception:", e);
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}