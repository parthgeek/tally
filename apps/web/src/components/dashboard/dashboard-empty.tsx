import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, PiggyBank, Eye, Building2 } from "lucide-react";
import Link from "next/link";

interface DashboardEmptyProps {
  orgName: string;
}

export function DashboardEmpty({ orgName }: DashboardEmptyProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to {orgName}! Let&apos;s get started by connecting your accounts.
        </p>
      </div>

      {/* Empty state with zero metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cash on Hand</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-muted-foreground">$0.00</div>
            <p className="text-xs text-muted-foreground mt-1">Connect accounts to see data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Safe to Spend</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-muted-foreground">$0.00</div>
            <p className="text-xs text-muted-foreground mt-1">Connect accounts to see data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Needs Review</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-muted-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">No transactions to review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Connections</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-muted-foreground">0</div>
            <p className="text-xs text-muted-foreground mt-1">No accounts connected</p>
          </CardContent>
        </Card>
      </div>

      {/* Empty state CTA */}
      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold">Connect your bank to get started</h3>
              <p className="text-sm text-muted-foreground">
                Connect your bank accounts and payment processors to automatically track your
                income, expenses, and get insights into your business finances.
              </p>
            </div>
            <Button asChild size="lg" className="mt-2">
              <Link href="/settings/connections">Connect Your Bank</Link>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              🔒 Secure connection powered by Plaid • Bank-level encryption
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
