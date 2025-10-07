"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPill } from "@/components/ui/category-pill";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { Label } from "@/components/ui/label";

export default function DesignSystemPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Design System</h1>
        <p className="text-muted-foreground">
          Preview of all design tokens and components in light and dark mode.
        </p>
      </div>

      {/* Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>All button variants and sizes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="ghost-subtle">Ghost Subtle</Button>
            <Button variant="notion">Notion</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">⚙️</Button>
            <Button size="icon-sm">🔍</Button>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
          <CardDescription>All badge variants including categories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="revenue">Revenue</Badge>
            <Badge variant="cogs">COGS</Badge>
            <Badge variant="opex">OpEx</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Category Pills */}
      <Card>
        <CardHeader>
          <CardTitle>Category Pills</CardTitle>
          <CardDescription>Two-tier category display</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Revenue Categories</Label>
            <div className="flex flex-wrap gap-2">
              <CategoryPill tier1="revenue" tier2="Product Sales" />
              <CategoryPill tier1="revenue" tier2="Service Revenue" />
              <CategoryPill tier1="revenue" tier2="Subscriptions" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>COGS Categories</Label>
            <div className="flex flex-wrap gap-2">
              <CategoryPill tier1="cogs" tier2="Materials" />
              <CategoryPill tier1="cogs" tier2="Shipping" />
              <CategoryPill tier1="cogs" tier2="Production" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>OpEx Categories</Label>
            <div className="flex flex-wrap gap-2">
              <CategoryPill tier1="opex" tier2="Marketing" />
              <CategoryPill tier1="opex" tier2="Salaries" />
              <CategoryPill tier1="opex" tier2="Software" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Uncategorized</Label>
            <div className="flex flex-wrap gap-2">
              <CategoryPill tier1={null} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confidence Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Confidence Badges</CardTitle>
          <CardDescription>AI confidence indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={0.98} />
              <span className="text-sm text-muted-foreground">High (98%)</span>
            </div>
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={0.85} />
              <span className="text-sm text-muted-foreground">Medium (85%)</span>
            </div>
            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={0.65} />
              <span className="text-sm text-muted-foreground">Low (65%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Form Inputs</CardTitle>
          <CardDescription>Input fields with different states</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="default">Default Input</Label>
            <Input id="default" placeholder="Enter text..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="disabled">Disabled Input</Label>
            <Input id="disabled" placeholder="Disabled" disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email Input</Label>
            <Input id="email" type="email" placeholder="email@example.com" />
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Cards</CardTitle>
          <CardDescription>Card components with hover effects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Metric Card</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">$12,345</div>
                <p className="text-xs text-muted-foreground mt-1">Revenue this month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Another Card</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">87%</div>
                <p className="text-xs text-muted-foreground mt-1">Categorization accuracy</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Color Palette</CardTitle>
          <CardDescription>All semantic colors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="h-16 rounded-md bg-background border border-border" />
              <p className="text-xs font-medium">Background</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md bg-card border border-border-subtle" />
              <p className="text-xs font-medium">Card</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md bg-primary" />
              <p className="text-xs font-medium">Primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md bg-muted" />
              <p className="text-xs font-medium">Muted</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md bg-revenue-bg border border-revenue-fg" />
              <p className="text-xs font-medium">Revenue</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md bg-cogs-bg border border-cogs-fg" />
              <p className="text-xs font-medium">COGS</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md bg-opex-bg border border-opex-fg" />
              <p className="text-xs font-medium">OpEx</p>
            </div>
            <div className="space-y-2">
              <div className="h-16 rounded-md bg-destructive-background border border-destructive" />
              <p className="text-xs font-medium">Destructive</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>Font hierarchy and styles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold">Heading 1 (32px)</h1>
            <h2 className="text-2xl font-semibold">Heading 2 (24px)</h2>
            <h3 className="text-xl font-semibold">Heading 3 (20px)</h3>
            <h4 className="text-lg font-semibold">Heading 4 (18px)</h4>
          </div>
          <div className="space-y-1">
            <p className="text-base">Body text (14px) - Regular weight</p>
            <p className="text-base font-medium">Body text (14px) - Medium weight</p>
            <p className="text-base font-semibold">Body text (14px) - Semibold weight</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Small text (12px) - Muted</p>
            <p className="text-tiny text-muted-foreground">Tiny text (11px) - Muted</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
