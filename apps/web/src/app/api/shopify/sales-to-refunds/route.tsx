// apps/web/app/settings/connections/sales-to-refunds/page.tsx
"use client";
import { useEffect, useState } from "react";

export default function SalesToRefundsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const orgId = "<YOUR_ORG_ID>"; // pull from session/context

  useEffect(() => {
    const since = new Date(Date.now() - 30*24*60*60*1000).toISOString(); // last 30 days
    fetch(`/api/shopify/sales-to-refunds?orgId=${orgId}&since=${encodeURIComponent(since)}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.text())))
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [orgId]);

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!data) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">Rows: {data.count}</div>
      <pre className="p-3 rounded bg-black/30 overflow-auto text-xs">
        {JSON.stringify(data.sales_to_refunds.slice(0, 20), null, 2)}
      </pre>
    </div>
  );
}
