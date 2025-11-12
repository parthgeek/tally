// app/api/shopify/install/route.ts
import { NextRequest } from "next/server";

/**
 * Redirect API that sends the browser to the Shopify install URL stored in
 * NEXT_PUBLIC_SHOPIFY_APP_URL. Returns an HTML page which forces a top-level
 * redirect (window.top) to avoid iframe framing issues.
 *
 * Usage:
 *  - Client: window.location.href = '/api/shopify/install'
 *  - Or link to /api/shopify/install
 */

export async function GET(req: NextRequest) {
  try {
    const installUrl = process.env.NEXT_PUBLIC_SHOPIFY_APP_URL;
    if (!installUrl) {
      const html = `<!doctype html>
        <html><head><meta charset="utf-8"><title>Missing URL</title></head>
        <body>
          <h1>Configuration error</h1>
          <p>Please set <code>NEXT_PUBLIC_SHOPIFY_APP_URL</code> in your environment.</p>
        </body></html>`;
      return new Response(html, { status: 500, headers: { "Content-Type": "text/html" } });
    }

    // Minimal HTML page that tries to perform a top-level redirect, with a fallback link
    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Redirecting to Shopify…</title>
          <style>
            body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f7fafc; color:#111827 }
            .card { background:white; padding:20px; border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,0.08); text-align:center; max-width:720px; }
            a { color:#1f6feb; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Redirecting to Shopify…</h1>
            <p>If your browser does not redirect automatically, <a id="manual" href="${installUrl}">click here to continue</a>.</p>
            <p style="margin-top:8px;color:#6b7280;font-size:13px">${installUrl}</p>
          </div>

          <script>
            (function() {
              var url = ${JSON.stringify(installUrl)};
              try {
                // If embedded in an iframe, force the top-level window to navigate
                if (window.top && window.top !== window.self) {
                  window.top.location.href = url;
                } else {
                  window.location.href = url;
                }
              } catch (e) {
                // If cross-origin access is blocked, fall back to navigating current window
                window.location.href = url;
              }
            })();
          </script>
        </body>
      </html>`;

    return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
  } catch (err: any) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head>
      <body><h1>Unexpected error</h1><pre>${String(err?.message ?? err)}</pre></body></html>`;
    return new Response(html, { status: 500, headers: { "Content-Type": "text/html" } });
  }
}
