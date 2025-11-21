  import { NextRequest } from "next/server";
import {
  withOrgFromRequest,
  createErrorResponse,
  createValidationErrorResponse,
} from "@/lib/api/with-org";
import { createServerClient } from "@/lib/supabase";
import { captureException } from "@nexus/analytics";
import { getPosthogClientServer } from "@nexus/analytics/server";

/**
 * POST /api/receipts/upload
 *
 * Upload receipt files for transaction attachment.
 * This is a stub implementation for Milestone 5, with full OCR processing planned for M6.
 *
 * Supported file types: image/jpeg, image/png, application/pdf
 * Max file size: 10MB
 *
 * Request: FormData with 'file' field
 * Response: { id, url }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify org membership and get context
    const { userId, orgId } = await withOrgFromRequest(request);

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      return createErrorResponse("Invalid form data", 400);
    }

    const file = formData.get("file") as File;
    if (!file) {
      return createErrorResponse("No file provided", 400);
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return createErrorResponse(
        `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
        400
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      return createErrorResponse("File size must be less than 10MB", 400);
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop() || "unknown";
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const storagePath = `receipts/${orgId}/${year}/${month}/${fileName}`;

    const supabase = await createServerClient();

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        duplex: "half",
      });

    if (uploadError) {
      console.error("Failed to upload file to storage:", uploadError);
      return createErrorResponse("Upload failed", 500);
    }

    // Create receipt record in database
    const { data: receiptRecord, error: dbError } = await supabase
      .from("receipts")
      .insert({
        org_id: orgId,
        uploaded_by: userId,
        storage_path: uploadData.path,
        original_filename: file.name,
        file_type: file.type,
        file_size: file.size,
        processing_status: "pending", // For future OCR processing
        created_at: new Date().toISOString(),
      })
      .select("id, storage_path")
      .single();

    if (dbError || !receiptRecord) {
      console.error("Failed to create receipt record:", dbError);

      // Clean up uploaded file if database insert fails
      try {
        await supabase.storage.from("receipts").remove([uploadData.path]);
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded file:", cleanupError);
      }

      return createErrorResponse("Failed to save receipt", 500);
    }

    // Get public URL for the uploaded file
    const {
      data: { publicUrl },
    } = supabase.storage.from("receipts").getPublicUrl(uploadData.path);

    // Track analytics event
    try {
      const posthog = await getPosthogClientServer();
      if (posthog) {
        await posthog.capture({
          distinctId: userId,
          event: "receipt_uploaded",
          properties: {
            org_id: orgId,
            user_id: userId,
            receipt_id: receiptRecord.id,
            file_type: file.type,
            file_size: file.size,
            file_extension: fileExt,
          },
        });
      }
    } catch (analyticsError) {
      console.error("Failed to capture receipt upload analytics:", analyticsError);
      // Don't fail the request if analytics fails
    }

    return Response.json({
      success: true,
      id: receiptRecord.id,
      url: publicUrl,
      message: "Receipt uploaded successfully. OCR processing will be added in M6.",
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Error in POST /api/receipts/upload:", error);

    try {
      await captureException(
        error instanceof Error ? error : new Error("Unknown receipt upload error")
      );
    } catch (analyticsError) {
      console.error("Failed to capture exception:", analyticsError);
    }

    return createErrorResponse("Internal server error", 500);
  }
}
