import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureException } from "@nexus/analytics";

/**
 * POST /api/waitlist
 *
 * Handles waitlist email submissions during prelaunch phase.
 * Uses Supabase service role key to bypass RLS.
 *
 * Security: Service role key is server-only, never exposed to client.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    // Validate email format
    if (!email || typeof email !== "string") {
      return Response.json({ error: "Valid email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Create admin client with service role key (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase configuration");
      captureException(new Error("Waitlist API: Missing Supabase configuration"));
      return Response.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Capture metadata for analytics
    const headers = Object.fromEntries(req.headers.entries());
    const source = headers["referer"] || null;
    const userAgent = headers["user-agent"] || null;

    // Normalize email (lowercase and trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Insert into waitlist
    const { error } = await admin.from("waitlist_submissions").insert({
      email: normalizedEmail,
      source,
      user_agent: userAgent,
    });

    if (error) {
      // Handle duplicate email gracefully (unique constraint violation)
      if (error.code === "23505") {
        return Response.json({ ok: true, duplicate: true });
      }

      console.error("Waitlist insert error:", error);
      captureException(error, {
        context: "waitlist_submission",
        email_domain: normalizedEmail.split("@")[1],
      });

      return Response.json({ error: "Failed to save email" }, { status: 500 });
    }

    // Note: PostHog tracking is server-side here (email domain tracking)
    // The client will also track via useWaitlist hook

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Waitlist API error:", err);
    captureException(err instanceof Error ? err : new Error(String(err)), {
      context: "waitlist_api",
    });

    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
