import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface DashboardLoadingProps {
  message?: string;
}

export function DashboardLoading({
  message = "Loading your financial overview...",
}: DashboardLoadingProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>

      {/* Skeleton cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Skeleton charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse">
              <div className="h-[280px] bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse">
              <div className="h-[200px] bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
