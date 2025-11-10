import type { NextRequest } from "next/server";
import { withOrgFromRequest } from "@/lib/api/with-org";

export async function GET(request: NextRequest) {
  try {
    await withOrgFromRequest(request);
    const searchParams = request.nextUrl.searchParams;

    // Extract OAuth parameters
    const publicToken = searchParams.get("public_token");
    const error = searchParams.get("error");
    const oauthStateId = searchParams.get("oauth_state_id");

    // Handle error cases
    if (error) {
      console.error("Plaid OAuth error:", error);
      return Response.redirect(
        new URL(`/settings/connections?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Handle successful OAuth with public token
    if (publicToken) {
      try {
        // Exchange public token for access token via our API route
        const exchangeResponse = await fetch(new URL("/api/plaid/exchange", request.url), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("Cookie") || "",
          },
          body: JSON.stringify({
            public_token: publicToken,
          }),
        });

        if (!exchangeResponse.ok) {
          throw new Error("Failed to exchange public token");
        }

        return Response.redirect(new URL("/settings/connections?success=true", request.url));
      } catch (exchangeError) {
        console.error("Token exchange error:", exchangeError);
        return Response.redirect(
          new URL("/settings/connections?error=exchange_failed", request.url)
        );
      }
    }

    // Handle OAuth state for Link reinitialization
    if (oauthStateId) {
      // Store OAuth state for Link reinitialization
      const redirectUrl = new URL("/settings/connections", request.url);
      redirectUrl.searchParams.set("oauth_state_id", oauthStateId);
      redirectUrl.searchParams.set("reinitialize_link", "true");

      return Response.redirect(redirectUrl.toString());
    }

    // Default redirect
    return Response.redirect(new URL("/settings/connections", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return Response.redirect(new URL("/settings/connections?error=oauth_failed", request.url));
  }
}
