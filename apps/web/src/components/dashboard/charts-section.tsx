import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface ChartData {
  chartData: Array<{ name: string; [key: string]: any }>;
  pieData: Array<{ name: string; value: number; color: string }>;
  trendData: Array<{ day: number; amount: number }>;
}

interface ChartsSectionProps {
  data: ChartData;
  timeRange: "30d" | "90d";
  trendDeltaPct: number;
  onTimeRangeChange: (range: "30d" | "90d") => void;
  onChartHover: (chart: "inout" | "top5" | "trend") => void;
}

export function ChartsSection({
  data,
  timeRange,
  trendDeltaPct,
  onTimeRangeChange,
  onChartHover,
}: ChartsSectionProps) {
  return (
    <>
      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Cash Flow Bar Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Cash Flow</CardTitle>
                <CardDescription className="text-xs mt-1">
                  Inflows and outflows over time
                </CardDescription>
              </div>
              {/* Pill-style time range toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => onTimeRangeChange("30d")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                    timeRange === "30d"
                      ? "bg-background text-foreground shadow-notion-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  30d
                </button>
                <button
                  onClick={() => onTimeRangeChange("90d")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                    timeRange === "90d"
                      ? "bg-background text-foreground shadow-notion-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  90d
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]" onMouseEnter={() => onChartHover("inout")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border-subtle))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey={timeRange} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Expenses Donut */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top Expenses</CardTitle>
            <CardDescription className="text-xs mt-1">Last 30 days by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]" onMouseEnter={() => onChartHover("top5")}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `$${Number(value).toLocaleString()}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {data.pieData.slice(0, 3).map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                    <span className="truncate text-xs">{entry.name}</span>
                  </div>
                  <span className="text-xs font-medium">${entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend Sparkline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Weekly Spending Trend</CardTitle>
              <CardDescription className="text-xs mt-1">
                Your spending pattern over the last 7 days
              </CardDescription>
            </div>
            <Badge variant={trendDeltaPct > 0 ? "destructive" : "success"} className="text-xs">
              {trendDeltaPct > 0 ? "+" : ""}
              {trendDeltaPct}% vs last month
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[180px]" onMouseEnter={() => onChartHover("trend")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trendData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border-subtle))"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, "Amount"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
