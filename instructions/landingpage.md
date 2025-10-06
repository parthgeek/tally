# Landing Page Implementation Plan

## 📋 Overview

**Objective:** Build a minimalist, high-converting landing page for Nexus that showcases the dashboard-first approach and captures waitlist signups during prelaunch validation phase.

**Target URL:** `/` (root landing page)

**Key Requirements:**
- Minimalist design matching existing app aesthetic
- Semi-interactive dashboard preview
- Waitlist email capture (no pricing, no testimonials)
- **PRELAUNCH LOCK: No access to any other pages (including sign-in/sign-up)**
- Mobile-first responsive design
- Fast load times (<2s)
- Accessibility compliant (WCAG 2.1 AA)

---

## 🎯 Scope

### Included Sections (5 Total)
1. **Hero Section** - Dashboard showcase + waitlist CTA
2. **Feature Spotlight Carousel** - 4 key features with visuals
3. **Problem Section** - Before/After comparison
4. **How It Works** - 3-step process
5. **Final CTA** - Waitlist signup with email input

### Excluded
- Social proof/testimonials
- Pricing section
- Stats/metrics section
- FAQ section
- Customer logos
- **Sign-in/Sign-up pages** (prelaunch lock active)
- **Any authenticated pages** (dashboard, transactions, etc.)

### Primary CTA
**Waitlist signup** with email input only (no full signup flow)

### Security Model (Prelaunch Lock)
**Mode:** Prelaunch validation - only landing page accessible
- `/` - Landing page (public)
- `/api/waitlist` - Waitlist submission endpoint (public)
- All other routes → Redirect to `/` or return 404
- Controlled by `PRELAUNCH_LOCK` environment variable
- Easy to disable when ready to launch (flip env var to `false`)

---

## 🎨 Design System

### Color Palette (From existing app)

```css
/* Light Mode (Primary) */
--background: 0 0% 100%;           /* #FFFFFF */
--foreground: 24 10% 20%;          /* #3F3933 */
--card: 0 0% 98%;                  /* #FAFAFA */
--primary: 210 100% 50%;           /* #0080FF */
--muted: 40 13% 95%;               /* #F5F3F0 */
--border: 40 13% 91%;              /* #E8E5DF */

/* Category Colors */
--revenue-bg: 210 100% 96%;        /* Light Blue */
--revenue-fg: 210 100% 35%;        /* Blue */
--cogs-bg: 33 100% 96%;            /* Light Orange */
--cogs-fg: 33 100% 30%;            /* Orange */
--opex-bg: 270 100% 97%;           /* Light Purple */
--opex-fg: 270 100% 35%;           /* Purple */

/* Semantic Colors */
--success: 142 71% 45%;            /* #22C55E Green */
--warning: 38 92% 50%;             /* #F59E0B Amber */
--destructive: 0 84% 60%;          /* #EF4444 Red */
```

### Typography

```
Font Family:
- Sans: Inter (with ligatures: "rlig", "calt", "ss01")
- Mono: JetBrains Mono (for numbers/dashboard data)

Scale:
- Display: 48px/56px, font-bold (Hero headline)
- H1: 36px/44px, font-bold
- H2: 24px/32px, font-semibold
- H3: 20px/28px, font-semibold
- Body: 16px/24px, font-normal
- Small: 14px/20px, font-normal
- Caption: 12px/16px, font-normal
```

### Spacing System

```
Base unit: 4px (rem units)
Scale: 1, 2, 3, 4, 6, 8, 12, 16, 24, 32 (in rem)

Section Padding:
- Desktop: 96px (24rem) top/bottom
- Mobile: 48px (12rem) top/bottom

Container:
- Max width: 1280px (80rem)
- Padding: 32px (8rem) on desktop, 24px (6rem) on mobile
```

### Border Radius

```
sm: 4px
md: 6px
lg: 8px
xl: 12px
```

### Shadows (Notion-style)

```
sm: 0 1px 2px rgba(15, 15, 15, 0.03)
md: 0 1px 3px rgba(15, 15, 15, 0.06)
lg: 0 2px 8px rgba(15, 15, 15, 0.08)
xl: 0 3px 12px rgba(15, 15, 15, 0.1)
hover: 0 4px 16px rgba(15, 15, 15, 0.12)
```

---

## 📁 File Structure

```
apps/web/src/
├── app/
│   ├── page.tsx                  # Landing page at root (replaces current root redirect)
│   └── api/
│       └── waitlist/
│           └── route.ts          # Waitlist API endpoint (POST only)
├── components/
│   └── landing/                  # New directory for landing page components
│       ├── hero-section.tsx
│       ├── dashboard-preview.tsx
│       ├── feature-carousel.tsx
│       ├── feature-card.tsx
│       ├── problem-section.tsx
│       ├── how-it-works.tsx
│       ├── waitlist-form.tsx
│       ├── final-cta.tsx
│       └── navigation.tsx        # Simple nav without auth links
├── middleware.ts                 # CRITICAL: Updated with prelaunch lock
├── lib/
│   └── waitlist.ts               # Waitlist utilities
└── hooks/
    └── use-waitlist.ts           # Waitlist form hook
```

**Note:** No separate `(marketing)` route group needed. The landing page replaces the root `/` during prelaunch mode. The existing `(auth)` and `(app)` pages remain in codebase but are inaccessible via middleware.

---

## 🏗️ Component Breakdown

### 1. Hero Section (`hero-section.tsx`)

**Purpose:** Capture attention immediately with dashboard preview and clear value proposition.

**Structure:**
```tsx
<section className="relative min-h-screen">
  <Navigation />
  <div className="container mx-auto px-6 pt-32 pb-16">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      {/* Left: Copy + CTA */}
      <div>
        <h1>AI-powered bookkeeping for DTC brands</h1>
        <p>Real-time P&L, automated COGS tracking, and tax-ready exports. Built for Shopify stores.</p>
        <WaitlistForm inline />
        <TrustBadges />
      </div>
      
      {/* Right: Dashboard Preview */}
      <DashboardPreview />
    </div>
  </div>
  
  {/* Scroll indicator */}
  <ScrollIndicator />
</section>
```

**Key Features:**
- Responsive grid (stacks on mobile)
- Dashboard preview on right (desktop) or below (mobile)
- Inline waitlist form
- Trust badges: "SOC 2 Compliant", "95%+ Accuracy", "67% Cost Savings", "Powered by Gemini"
- Smooth scroll indicator at bottom

**Styling:**
- Background: `bg-background`
- Text: `text-foreground`
- Headline: 48px on desktop, 36px on mobile
- Subtle gradient background (white to muted)

---

### 2. Dashboard Preview (`dashboard-preview.tsx`)

**Purpose:** Show actual dashboard UI with semi-interactive elements.

**Structure:**
```tsx
<div className="relative">
  {/* Dashboard container with shadow */}
  <div className="rounded-xl shadow-xl border border-border bg-card overflow-hidden">
    {/* Header */}
    <div className="border-b border-border p-4">
      <div className="flex items-center justify-between">
        <h3>Dashboard</h3>
        <DateRangePicker /> {/* Non-functional, visual only */}
      </div>
    </div>
    
    {/* Metrics Cards */}
    <div className="p-6 grid grid-cols-3 gap-4">
      <MetricCard label="Revenue" value="$124,382" change="+12.3%" />
      <MetricCard label="COGS" value="$52,180" change="-3.2%" />
      <MetricCard label="Gross Margin" value="58.1%" change="+2.1%" />
    </div>
    
    {/* Chart Area */}
    <div className="p-6 pt-0">
      <AnimatedChart data={mockChartData} />
    </div>
    
    {/* Recent Transactions */}
    <div className="p-6 pt-0">
      <h4>Recent Transactions</h4>
      <TransactionList transactions={mockTransactions} />
    </div>
  </div>
  
  {/* Decorative elements */}
  <div className="absolute -z-10 inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
</div>
```

**Interactivity:**
- Hover tooltips on metrics (explain what they mean)
- Animated chart on scroll into view
- Live-updating transaction list (simulated every 3s)
- Subtle pulse animation on new transactions
- Click on chart shows tooltip with data point

**Animation:**
- Chart draws on load (300ms stagger)
- Metrics count up from 0 (500ms duration)
- Transactions fade in sequentially (100ms stagger)

**Mock Data:**
```typescript
const mockTransactions = [
  {
    id: '1',
    date: '2024-10-06',
    description: 'Shopify Payout',
    amount: 12847.50,
    category: 'DTC Sales',
    categoryType: 'revenue',
    confidence: 0.98,
  },
  // ... 5-6 sample transactions
];

const mockChartData = [
  { date: '2024-09-01', revenue: 98234, cogs: 41203, opex: 23456 },
  // ... 30 days of data
];
```

---

### 3. Feature Carousel (`feature-carousel.tsx`)

**Purpose:** Showcase 4 key features with interactive carousel.

**Structure:**
```tsx
<section className="py-24 bg-muted/30">
  <div className="container mx-auto px-6">
    <div className="text-center mb-12">
      <p className="text-sm font-semibold text-primary uppercase tracking-wide">
        Built for E-commerce
      </p>
      <h2 className="text-3xl font-bold mt-2">
        Every feature designed for DTC brands
      </h2>
    </div>
    
    {/* Carousel */}
    <div className="relative">
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8">
        {features.map(feature => (
          <FeatureCard key={feature.id} {...feature} />
        ))}
      </div>
      
      {/* Navigation dots */}
      <div className="flex justify-center gap-2 mt-8">
        {features.map((_, i) => (
          <button
            key={i}
            className={cn("w-2 h-2 rounded-full", 
              activeIndex === i ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </div>
    </div>
  </div>
</section>
```

**Features to Showcase:**

1. **AI Categorization**
   - Headline: "Smart categorization with 95%+ accuracy"
   - Description: "Google Gemini AI automatically categorizes transactions into 38 e-commerce categories. No manual data entry."
   - Visual: Transaction being categorized with confidence score
   - Icon: Sparkles (AI)

2. **Real-time P&L**
   - Headline: "Know your numbers every day"
   - Description: "Real-time profit & loss statements with revenue, COGS, and margin tracking. No month-end waiting."
   - Visual: Live P&L dashboard with animated updates
   - Icon: TrendingUp

3. **COGS Tracking**
   - Headline: "True profitability, not just revenue"
   - Description: "Track inventory costs, packaging, and freight. See your real gross margins instantly."
   - Visual: Margin breakdown chart
   - Icon: Package

4. **Shopify Payout Reconciliation**
   - Headline: "Shopify payouts, decoded"
   - Description: "Automatically separate fees, refunds, and net revenue. Every penny accounted for."
   - Visual: Payout breakdown table
   - Icon: Shopify logo

**FeatureCard Component:**
```tsx
<div className="flex-shrink-0 w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] snap-start">
  <div className="bg-card border border-border rounded-xl p-6 h-full shadow-md hover:shadow-lg transition-shadow">
    {/* Icon */}
    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    
    {/* Content */}
    <h3 className="text-xl font-semibold mb-2">{headline}</h3>
    <p className="text-muted-foreground mb-6">{description}</p>
    
    {/* Visual */}
    <div className="rounded-lg border border-border overflow-hidden">
      <FeatureVisual type={visualType} />
    </div>
  </div>
</div>
```

**Carousel Behavior:**
- Horizontal scroll on mobile (snap points)
- 2 columns on tablet, 3 on desktop
- Keyboard navigation (arrow keys)
- Touch swipe enabled
- Auto-rotate disabled (user-controlled only)

---

### 4. Problem Section (`problem-section.tsx`)

**Purpose:** Show before/after comparison of bookkeeping with/without Nexus.

**Structure:**
```tsx
<section className="py-24">
  <div className="container mx-auto px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl font-bold">
        Stop wrestling with spreadsheets
      </h2>
      <p className="text-muted-foreground mt-4 text-lg">
        Traditional bookkeeping wasn't built for e-commerce
      </p>
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      {/* BEFORE */}
      <div className="relative">
        <div className="absolute -top-4 left-4">
          <span className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-sm font-medium">
            Without Nexus
          </span>
        </div>
        
        <div className="border border-border rounded-xl p-8 bg-card">
          <ul className="space-y-4">
            <ProblemItem icon="X" text="10+ hours monthly on manual reconciliation" />
            <ProblemItem icon="X" text="Messy spreadsheets with broken formulas" />
            <ProblemItem icon="X" text="No idea if you're actually profitable" />
            <ProblemItem icon="X" text="Tax season panic and expensive CPAs" />
            <ProblemItem icon="X" text="Payment processor fees buried in 'other'" />
          </ul>
        </div>
      </div>
      
      {/* AFTER */}
      <div className="relative">
        <div className="absolute -top-4 left-4">
          <span className="bg-success/10 text-success px-3 py-1 rounded-full text-sm font-medium">
            With Nexus
          </span>
        </div>
        
        <div className="border border-primary/20 rounded-xl p-8 bg-card ring-2 ring-primary/10">
          <ul className="space-y-4">
            <SolutionItem icon="Check" text="Automated categorization in seconds" />
            <SolutionItem icon="Check" text="Real-time P&L, always up-to-date" />
            <SolutionItem icon="Check" text="Know your margins and unit economics" />
            <SolutionItem icon="Check" text="Tax-ready exports in one click" />
            <SolutionItem icon="Check" text="Every fee tracked and categorized" />
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>
```

**Animation:**
- Scroll trigger: Before section fades in first
- After section slides in from right with 200ms delay
- Checkmarks animate in with bounce effect

**Styling:**
- Before: Muted colors, no special treatment
- After: Primary border, subtle glow, elevated appearance
- Icons: X (destructive color) vs Check (success color)

---

### 5. How It Works (`how-it-works.tsx`)

**Purpose:** Show simple 3-step onboarding process.

**Structure:**
```tsx
<section className="py-24 bg-muted/30">
  <div className="container mx-auto px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl font-bold">Get started in 3 steps</h2>
      <p className="text-muted-foreground mt-4 text-lg">
        No accounting degree required
      </p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      <StepCard
        number={1}
        title="Connect Shopify"
        description="Link your Shopify store in 60 seconds. Bank account connections via Plaid."
        time="1 minute"
        icon={<Link className="w-8 h-8" />}
      />
      
      <StepCard
        number={2}
        title="Review Dashboard"
        description="AI categorizes your transactions automatically. Review and approve in 5 minutes."
        time="5 minutes"
        icon={<Eye className="w-8 h-8" />}
      />
      
      <StepCard
        number={3}
        title="Export Reports"
        description="Tax-ready data for QuickBooks, Xero, or CSV. One-click exports anytime."
        time="1 click"
        icon={<Download className="w-8 h-8" />}
      />
    </div>
  </div>
</section>
```

**StepCard Component:**
```tsx
<div className="relative">
  {/* Connector line (hidden on mobile, last card) */}
  {index < 2 && (
    <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-border z-0" />
  )}
  
  <div className="relative bg-card border border-border rounded-xl p-8 shadow-md">
    {/* Step number */}
    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
      {number}
    </div>
    
    {/* Icon */}
    <div className="text-primary mb-4">{icon}</div>
    
    {/* Content */}
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground mb-4">{description}</p>
    
    {/* Time estimate */}
    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span>{time}</span>
    </div>
  </div>
</div>
```

**Animation:**
- Steps fade in sequentially on scroll (200ms stagger)
- Connector lines draw from left to right
- Hover: Card lifts slightly with shadow increase

---

### 6. Final CTA (`final-cta.tsx`)

**Purpose:** Convert visitors to waitlist signups.

**Structure:**
```tsx
<section className="py-24">
  <div className="container mx-auto px-6">
    <div className="max-w-3xl mx-auto text-center">
      {/* Dashboard thumbnail */}
      <div className="mb-8 rounded-xl overflow-hidden shadow-xl border border-border inline-block">
        <Image 
          src="/dashboard-preview.png" 
          alt="Nexus Dashboard"
          width={600}
          height={400}
          className="w-full"
        />
      </div>
      
      {/* Copy */}
      <h2 className="text-4xl font-bold mb-4">
        Ready to see your real numbers?
      </h2>
      <p className="text-xl text-muted-foreground mb-8">
        Join the waitlist and be the first to know when we launch
      </p>
      
      {/* Waitlist form */}
      <WaitlistForm />
      
      {/* Trust signals */}
      <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>SOC 2 Compliant</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4" />
          <span>256-bit Encryption</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" />
          <span>Powered by Gemini</span>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

### 7. Waitlist Form (`waitlist-form.tsx`)

**Purpose:** Capture email addresses for waitlist.

**Structure:**
```tsx
'use client';

import { useState } from 'react';
import { useWaitlist } from '@/hooks/use-waitlist';

export function WaitlistForm({ inline = false }) {
  const { subscribe, isLoading, error, success } = useWaitlist();
  const [email, setEmail] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await subscribe(email);
  };
  
  if (success) {
    return (
      <div className="rounded-lg bg-success/10 border border-success/20 p-4 text-center">
        <Check className="w-6 h-6 text-success mx-auto mb-2" />
        <p className="text-success font-medium">
          You're on the list! Check your email for confirmation.
        </p>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className={inline ? "flex gap-2" : "space-y-4"}>
      <div className="flex-1">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
          disabled={isLoading}
        />
      </div>
      
      <Button 
        type="submit" 
        size={inline ? "default" : "lg"}
        disabled={isLoading}
        className="whitespace-nowrap"
      >
        {isLoading ? 'Joining...' : 'Join Waitlist'}
      </Button>
      
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </form>
  );
}
```

**Features:**
- Email validation (client + server side)
- Loading state during submission
- Success confirmation
- Error handling
- Inline variant for hero section
- Full-width variant for final CTA

---

### 8. Navigation (`navigation.tsx`)

**Purpose:** Simple header navigation (prelaunch mode - no auth links).

**Structure:**
```tsx
<nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
  <div className="container mx-auto px-6">
    <div className="flex items-center justify-between h-16">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Logo className="w-8 h-8" />
        <span className="font-bold text-xl">Nexus</span>
      </div>
      
      {/* Desktop Nav - Only anchor links during prelaunch */}
      <div className="hidden md:flex items-center gap-6">
        <a href="#features" className="text-sm hover:text-primary">
          Features
        </a>
        <a href="#how-it-works" className="text-sm hover:text-primary">
          How It Works
        </a>
        <Button size="sm" asChild>
          <a href="#waitlist">Join Waitlist</a>
        </Button>
      </div>
      
      {/* Mobile: Just CTA */}
      <Button size="sm" className="md:hidden" asChild>
        <a href="#waitlist">Join Waitlist</a>
      </Button>
    </div>
  </div>
</nav>
```

**Features:**
- Fixed position with backdrop blur
- Smooth scroll to sections via anchor links
- **NO sign-in/sign-up buttons during prelaunch**
- Mobile: simplified to just CTA button
- Logo is non-clickable (already on landing page)

---

## 🔌 API Implementation

### Waitlist Endpoint (`/api/waitlist/route.ts`)

**Security Note:** Uses Supabase service role key (server-only) to bypass RLS. Never expose this key to the client.

```typescript
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    // Validate email
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Valid email is required" }, { status: 400 });
    }

    // Create admin client with service role key (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { 
      auth: { persistSession: false } 
    });

    // Capture metadata
    const headers = Object.fromEntries(req.headers.entries());
    const source = headers["referer"] || null;
    const userAgent = headers["user-agent"] || null;

    // Insert into waitlist
    const { error } = await admin
      .from("waitlist_submissions")
      .insert({ 
        email: email.toLowerCase().trim(), 
        source, 
        user_agent: userAgent 
      });

    if (error) {
      // Handle duplicate email gracefully
      if (error.code === "23505") {
        return Response.json({ ok: true, duplicate: true });
      }
      console.error("Waitlist insert error:", error);
      return Response.json({ error: "Failed to save" }, { status: 500 });
    }

    // TODO: Track with PostHog
    // posthog.capture('waitlist_signup', { email_domain: email.split('@')[1] });
    
    // TODO: Send confirmation email via Resend/SendGrid
    // await sendWaitlistConfirmation(email);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Waitlist API error:", err);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

### Database Schema

```sql
-- Create waitlist submissions table
CREATE TABLE IF NOT EXISTS public.waitlist_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX idx_waitlist_submissions_email ON waitlist_submissions(email);
CREATE INDEX idx_waitlist_submissions_created_at ON waitlist_submissions(created_at DESC);

-- Enable RLS (service role key bypasses this anyway)
ALTER TABLE public.waitlist_submissions ENABLE ROW LEVEL SECURITY;

-- No public policies needed - all access via service role key
```

**Migration:** Run this SQL in Supabase SQL Editor before deploying.

---

## 🔒 Middleware Implementation (CRITICAL)

### Updated `src/middleware.ts`

**This is the most critical file for prelaunch security. It must be implemented correctly.**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase";

/**
 * Helper function to create a redirect response while preserving cookies
 */
function createRedirectWithCookies(url: string, req: NextRequest, originalRes: NextResponse) {
  const redirectRes = NextResponse.redirect(new URL(url, req.url));
  const cookies = originalRes.cookies.getAll();
  cookies.forEach(cookie => {
    redirectRes.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirectRes;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ===== PRELAUNCH LOCK =====
  // When enabled, ONLY the landing page and waitlist API are accessible
  const PRELAUNCH_LOCK =
    process.env.PRELAUNCH_LOCK === "true" || 
    process.env.NEXT_PUBLIC_PRELAUNCH_LOCK === "true";

  if (PRELAUNCH_LOCK) {
    const pathname = req.nextUrl.pathname;
    
    // Allow only landing page and waitlist API
    const publicPaths = new Set<string>([
      "/",
      "/api/waitlist",
    ]);

    if (publicPaths.has(pathname)) {
      return res;
    }

    // For non-GET requests (e.g., API POSTs), return 404
    if (req.method !== "GET") {
      return new NextResponse(null, { status: 404 });
    }

    // Redirect all other GET requests to landing page
    return createRedirectWithCookies("/", req, res);
  }

  // ===== NORMAL AUTH FLOW (when prelaunch lock is OFF) =====
  const supabase = createMiddlewareSupabaseClient(req, res);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const session = user ? { user } : null;

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/sign-in") ||
    req.nextUrl.pathname.startsWith("/sign-up") ||
    req.nextUrl.pathname.startsWith("/reset-password");

  const isOnboardingPage = req.nextUrl.pathname.startsWith("/onboarding");

  // Guard app pages
  const isAppPage =
    req.nextUrl.pathname.startsWith("/dashboard") ||
    req.nextUrl.pathname.startsWith("/transactions") ||
    req.nextUrl.pathname.startsWith("/reports") ||
    req.nextUrl.pathname.startsWith("/settings") ||
    req.nextUrl.pathname.startsWith("/exports") ||
    isOnboardingPage;

  // Redirect unauthenticated users to sign-in for app pages
  if (!session && isAppPage) {
    return createRedirectWithCookies("/sign-in", req, res);
  }

  // Redirect authenticated users away from auth pages
  if (session && isAuthPage) {
    const { data: userOrgRoles } = await supabase
      .from("user_org_roles")
      .select("org_id")
      .eq("user_id", session.user.id)
      .limit(1);

    if (userOrgRoles && userOrgRoles.length > 0) {
      return createRedirectWithCookies("/dashboard", req, res);
    } else {
      return createRedirectWithCookies("/onboarding", req, res);
    }
  }

  // For authenticated users accessing app pages (excluding onboarding),
  // check if they have an org membership
  if (session && isAppPage && !isOnboardingPage) {
    const { data: userOrgRoles } = await supabase
      .from("user_org_roles")
      .select("org_id")
      .eq("user_id", session.user.id)
      .limit(1);

    if (!userOrgRoles || userOrgRoles.length === 0) {
      return createRedirectWithCookies("/onboarding", req, res);
    }
  }

  // Handle root path redirects (only when lock is off)
  if (req.nextUrl.pathname === "/" && session) {
    const { data: userOrgRoles } = await supabase
      .from("user_org_roles")
      .select("org_id")
      .eq("user_id", session.user.id)
      .limit(1);

    if (userOrgRoles && userOrgRoles.length > 0) {
      return createRedirectWithCookies("/dashboard", req, res);
    } else {
      return createRedirectWithCookies("/onboarding", req, res);
    }
  }

  if (req.nextUrl.pathname === "/" && !session) {
    return createRedirectWithCookies("/sign-in", req, res);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Key Security Features:**
1. Prelaunch lock check runs FIRST before any auth logic
2. When locked, only `/` and `/api/waitlist` are accessible
3. Non-GET requests (except waitlist) return 404
4. All other paths redirect to landing page
5. Easy to disable by setting env var to `false`

---

## 🪝 Custom Hooks

### `use-waitlist.ts`

```typescript
'use client';

import { useState } from 'react';

interface UseWaitlistReturn {
  subscribe: (email: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export function useWaitlist(): UseWaitlistReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const subscribe = async (email: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      const response = await fetch('/api/waitlist/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing_page' }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }
      
      setSuccess(true);
      
      // TODO: Track with PostHog
      // posthog.capture('waitlist_joined', { email });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };
  
  return { subscribe, isLoading, error, success };
}
```

---

## 📱 Responsive Breakpoints

```typescript
// Tailwind breakpoints (already configured)
// sm: 640px   - Mobile landscape
// md: 768px   - Tablet
// lg: 1024px  - Desktop
// xl: 1280px  - Large desktop
// 2xl: 1536px - Extra large

// Layout adjustments by breakpoint:

// Mobile (<640px):
- Single column layouts
- Stacked hero (copy on top, dashboard below)
- Horizontal scroll carousel
- Larger tap targets (min 44px)
- Reduced padding (24px vs 32px)
- Smaller typography (36px headlines vs 48px)

// Tablet (640px - 1024px):
- 2 column feature grid
- Side-by-side problem section
- Reduced dashboard preview size
- Medium padding

// Desktop (1024px+):
- Full 2 column hero
- 3 column feature grid
- Full-size dashboard preview
- Max container width: 1280px
- Full padding (32px)
```

---

## 🎬 Animation Details

### Scroll Animations

Use Intersection Observer API or Framer Motion:

```typescript
import { useInView } from 'framer-motion';
import { useRef } from 'react';

export function AnimatedSection({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  return (
    <div
      ref={ref}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(50px)',
        transition: 'all 0.5s cubic-bezier(0.17, 0.55, 0.55, 1)',
      }}
    >
      {children}
    </div>
  );
}
```

### Key Animations

1. **Hero Dashboard:**
   - Slide up + fade in on load
   - Chart draws from left to right (300ms)
   - Metrics count up (500ms)
   - Duration: 800ms total

2. **Feature Cards:**
   - Fade in on scroll into view
   - Stagger: 100ms between cards
   - Hover: Lift + shadow (150ms)

3. **Problem Section:**
   - Before section: Fade in
   - After section: Slide from right + fade (200ms delay)
   - Icons animate in with bounce

4. **How It Works:**
   - Steps fade in sequentially (200ms stagger)
   - Connector lines draw left to right
   - Number badges pulse on enter

5. **Waitlist Form:**
   - Success: Checkmark animation + confetti (optional)
   - Error: Shake animation (300ms)
   - Loading: Button spinner

### Performance Considerations

- Use `will-change` sparingly
- Prefer `transform` and `opacity` (GPU-accelerated)
- `requestAnimationFrame` for scroll animations
- Lazy load images below fold
- Preload hero dashboard preview image

---

## ♿ Accessibility

### Requirements

1. **Keyboard Navigation:**
   - All interactive elements focusable
   - Visible focus indicators (ring-2 ring-primary)
   - Skip to content link
   - Logical tab order

2. **Screen Readers:**
   - Semantic HTML (nav, section, main, article)
   - ARIA labels for icons
   - Alt text for all images
   - Form labels properly associated

3. **Color Contrast:**
   - WCAG AA minimum (4.5:1 for text)
   - Test with Chrome DevTools
   - Don't rely on color alone

4. **Motion:**
   - Respect `prefers-reduced-motion`
   - Disable animations if set

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

5. **Focus Management:**
   - Modal/form focus trap
   - Return focus after close
   - Manage focus on navigation

---

## ⚡ Performance Optimization

### Image Optimization

```tsx
import Image from 'next/image';

// Use Next.js Image component
<Image
  src="/dashboard-preview.png"
  alt="Nexus Dashboard"
  width={1200}
  height={800}
  priority={isAboveFold}
  quality={90}
  placeholder="blur"
  blurDataURL="data:image/..." // Generate with plaiceholder
/>
```

### Code Splitting

```tsx
// Lazy load heavy components
import dynamic from 'next/dynamic';

const DashboardPreview = dynamic(
  () => import('@/components/landing/dashboard-preview'),
  { loading: () => <DashboardSkeleton /> }
);

const FeatureCarousel = dynamic(
  () => import('@/components/landing/feature-carousel'),
  { ssr: true } // SSR for SEO
);
```

### Font Loading

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap', // FOUT strategy
});

const jetbrainsMono = localFont({
  src: '../fonts/JetBrainsMono-Variable.woff2',
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
```

### Bundle Size

- Minimize dependencies
- Tree-shake unused code
- Use `@next/bundle-analyzer`
- Target: <100KB JS for initial load

### Lighthouse Goals

- Performance: 90+
- Accessibility: 100
- Best Practices: 100
- SEO: 100

---

## 🔍 SEO Implementation

### Meta Tags

```tsx
// app/(marketing)/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nexus | AI-Powered Bookkeeping for DTC Brands',
  description: 'Automated bookkeeping for Shopify stores. Real-time P&L, COGS tracking, and tax-ready exports. Built for e-commerce.',
  keywords: 'shopify bookkeeping, dtc accounting, ecommerce bookkeeping, automated bookkeeping, shopify accounting',
  authors: [{ name: 'Nexus' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nexus.app',
    title: 'Nexus | AI-Powered Bookkeeping for DTC Brands',
    description: 'Automated bookkeeping for Shopify stores.',
    siteName: 'Nexus',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Nexus Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus | AI-Powered Bookkeeping for DTC Brands',
    description: 'Automated bookkeeping for Shopify stores.',
    images: ['/og-image.png'],
    creator: '@nexusapp', // TODO: Update with real handle
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

### Structured Data

```tsx
// Add JSON-LD schema
export default function LandingPage() {
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Nexus',
    applicationCategory: 'BusinessApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'AI-powered bookkeeping for DTC e-commerce brands',
  };
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      {/* Page content */}
    </>
  );
}
```

---

## 📊 Analytics Implementation

### PostHog Events to Track

```typescript
// Landing page events
'landing_page_viewed'
'waitlist_form_viewed'
'waitlist_form_submitted'
'waitlist_form_success'
'waitlist_form_error'
'feature_card_clicked'
'dashboard_preview_interacted'
'cta_button_clicked'
'navigation_link_clicked'

// Properties to include
{
  page_section: 'hero' | 'features' | 'problem' | 'how_it_works' | 'final_cta',
  feature_name: string, // for feature cards
  error_message: string, // for errors
  email_domain: string, // for waitlist (e.g., 'gmail.com')
}
```

### Implementation

```typescript
// components/landing/waitlist-form.tsx
import { usePostHog } from 'posthog-js/react';

export function WaitlistForm() {
  const posthog = usePostHog();
  
  const handleSubmit = async (email: string) => {
    posthog.capture('waitlist_form_submitted', {
      email_domain: email.split('@')[1],
      page_section: 'hero', // or 'final_cta'
    });
    
    try {
      await subscribe(email);
      posthog.capture('waitlist_form_success');
    } catch (error) {
      posthog.capture('waitlist_form_error', {
        error_message: error.message,
      });
    }
  };
  
  // ... rest of component
}
```

---

## 🧪 Testing Checklist

### Security Testing (CRITICAL - Test First)

**Prelaunch Lock Verification:**
- [ ] Set `PRELAUNCH_LOCK=true` in environment
- [ ] Visit `/` - should show landing page ✅
- [ ] Visit `/sign-in` - should redirect to `/` ✅
- [ ] Visit `/sign-up` - should redirect to `/` ✅
- [ ] Visit `/dashboard` - should redirect to `/` ✅
- [ ] Visit `/transactions` - should redirect to `/` ✅
- [ ] Visit `/settings` - should redirect to `/` ✅
- [ ] Visit `/onboarding` - should redirect to `/` ✅
- [ ] POST to `/api/waitlist` - should work ✅
- [ ] POST to `/api/transactions` - should return 404 ✅
- [ ] GET `/api/connections` - should redirect to `/` ✅
- [ ] Try authenticated user - still locked out ✅
- [ ] Check browser console for errors ✅

**Waitlist Functionality:**
- [ ] Submit valid email - saves to database
- [ ] Submit duplicate email - handles gracefully
- [ ] Submit invalid email - shows error
- [ ] Submit empty email - shows error
- [ ] Check Supabase `waitlist_submissions` table for entries
- [ ] Verify `source` and `user_agent` captured

### Manual Testing

- [ ] All sections render correctly on mobile/tablet/desktop
- [ ] Dashboard preview is semi-interactive (hover tooltips work)
- [ ] Feature carousel scrolls smoothly
- [ ] Waitlist form validates email
- [ ] Waitlist form shows success state
- [ ] Waitlist form shows error state
- [ ] Navigation links scroll to sections smoothly
- [ ] All animations trigger on scroll
- [ ] Images load with proper blur placeholders
- [ ] Fonts load without FOIT
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works throughout
- [ ] Screen reader announces content properly
- [ ] Focus indicators are visible
- [ ] Reduced motion is respected

### Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Performance Testing

- [ ] Lighthouse score: 90+ performance
- [ ] First Contentful Paint: <1.8s
- [ ] Largest Contentful Paint: <2.5s
- [ ] Cumulative Layout Shift: <0.1
- [ ] Time to Interactive: <3.8s
- [ ] Total bundle size: <100KB JS

### A/B Test Ideas (Future)

- Headline variations
- CTA button copy ("Join Waitlist" vs "Get Early Access")
- Hero dashboard position (left vs right)
- Feature order in carousel
- Problem section (with vs without)

---

## 📋 Implementation Steps

### Phase 0: Prelaunch Lock Setup (Day 1 - Priority)

**CRITICAL: Implement this first to ensure security**

1. **Update `src/middleware.ts`:**
   - Add prelaunch lock check at the top of middleware
   - When `PRELAUNCH_LOCK=true`, only allow `/` and `/api/waitlist`
   - Redirect all other GET requests to `/`
   - Return 404 for all other non-GET requests
   - Preserve existing auth logic for when lock is disabled

2. **Add environment variable:**
   - Railway: `PRELAUNCH_LOCK=true`
   - Local `.env.local`: `PRELAUNCH_LOCK=true`
   - Document how to disable for launch

3. **Create database migration for waitlist table:**
   - Run SQL in Supabase SQL Editor
   - Table: `waitlist_submissions`
   - Columns: id, email (unique), source, user_agent, created_at

4. **Implement waitlist API endpoint:**
   - Create `/api/waitlist/route.ts`
   - Use Supabase service role key (server-only)
   - Validate email server-side
   - Handle duplicate emails gracefully
   - Add metadata tracking (source, user agent)

5. **Test security:**
   - Verify `/dashboard` redirects to `/`
   - Verify `/sign-in` redirects to `/`
   - Verify `/sign-up` redirects to `/`
   - Verify `/api/transactions` returns 404
   - Verify only `/` and `/api/waitlist` are accessible

### Phase 1: Landing Page Structure (Day 2-3)

1. Replace `src/app/page.tsx` with landing page
2. Add navigation component (no auth links)
3. Create component directory structure

### Phase 2: Hero Section (Day 4-5)

1. Build hero section layout
2. Create dashboard preview component
3. Add semi-interactive elements (tooltips, hover states)
4. Implement animated chart
5. Add mock transaction list with live updates
6. Build inline waitlist form
7. Add trust badges

### Phase 3: Feature Sections (Day 6-7)

1. Create feature carousel component
2. Build feature cards with visuals
3. Implement problem section (before/after)
4. Add how it works section
5. Create step cards

### Phase 4: Final CTA (Day 8)

1. Build final CTA section
2. Add full-width waitlist form
3. Add trust signals
4. Test form submission end-to-end

### Phase 5: Polish (Day 9-10)

1. Add all animations (scroll-triggered)
2. Implement responsive design
3. Optimize images
4. Add loading states
5. Implement error handling
6. Add accessibility features
7. Test keyboard navigation

### Phase 6: Analytics & SEO (Day 11)

1. Add PostHog event tracking
2. Implement metadata
3. Add structured data
4. Create OG images
5. Test SEO with tools

### Phase 7: Security Testing & Launch (Day 12)

1. **CRITICAL: Security verification**
   - Test prelaunch lock on all routes
   - Verify `/sign-in` inaccessible
   - Verify `/sign-up` inaccessible
   - Verify `/dashboard` inaccessible
   - Verify API routes (except waitlist) return 404
   - Test with unauthenticated browser
   - Test with authenticated user (should still be locked out)
2. Manual testing across devices
3. Browser compatibility testing
4. Performance optimization
5. Lighthouse audit
6. Accessibility audit
7. Waitlist form testing (duplicate emails, validation, errors)
8. Final QA
9. Deploy to Railway with `PRELAUNCH_LOCK=true`

---

## 🚀 Deployment

### Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database migration run
- [ ] Analytics configured (PostHog)
- [ ] Error monitoring (Sentry)
- [ ] Images optimized
- [ ] SEO metadata added
- [ ] OG images created
- [ ] Robots.txt configured
- [ ] Sitemap generated

### Environment Variables (Railway)

**Required for prelaunch mode:**

```bash
# Prelaunch Lock - CRITICAL
PRELAUNCH_LOCK=true

# Supabase (required for waitlist API)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key  # Server-only, never expose to client

# Optional but recommended
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Node environment
NODE_ENV=production
```

**When ready to launch (disable lock):**
```bash
PRELAUNCH_LOCK=false
# or remove the variable entirely
```

### Railway Deployment

1. **Service Configuration:**
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter @nexus/web build`
   - Start command: `pnpm --filter @nexus/web start`
   - Or if deploying just the web app: `cd apps/web && npm install && npm run build && npm start`

2. **Add environment variables** in Railway service settings (see above)

3. **Verify deployment:**
   - Visit your Railway URL
   - Should see landing page at `/`
   - Try visiting `/sign-in` → should redirect to `/`
   - Try visiting `/dashboard` → should redirect to `/`
   - Submit email to waitlist → should save to Supabase

4. **Monitor logs** for any errors during waitlist submissions

---

## 📝 Future Enhancements

### Phase 2 (Post-Launch)

1. **Email Confirmation:**
   - Send welcome email via Resend/SendGrid
   - Double opt-in for waitlist
   - Email templates

2. **Social Proof:**
   - Add testimonials once available
   - Show waitlist count ("Join 500+ others")
   - Display customer logos

3. **Interactive Demo:**
   - Full clickable dashboard demo
   - Sandbox mode with sample data
   - Guided tour with tooltips

4. **Content:**
   - Blog section
   - FAQ page
   - Use case pages (by industry)

5. **Conversion Optimization:**
   - A/B testing framework
   - Heatmap analysis (Hotjar)
   - Exit intent popups

6. **Advanced Features:**
   - Video testimonials
   - ROI calculator
   - Live chat widget
   - Comparison page (vs QuickBooks, Xero)

---

## 🎨 Design Assets Needed

### Images

- [ ] Logo (SVG, multiple sizes)
- [ ] Dashboard preview (PNG, 2400x1600px @2x)
- [ ] Feature visuals (4 images, 800x600px)
- [ ] OG image (1200x630px)
- [ ] Favicon (ICO, PNG, SVG)
- [ ] Apple touch icon (180x180px)

### Icons

Using Lucide React (already installed):
- Check, X, Sparkles, TrendingUp, Package, Link, Eye, Download, Clock, Shield, Lock, Zap, Menu, ArrowRight

### Mockups

- [ ] Dashboard screenshot (light mode)
- [ ] Transaction categorization view
- [ ] P&L statement view
- [ ] COGS breakdown chart
- [ ] Shopify payout reconciliation table

### Typography

Already configured:
- Inter (Google Fonts, variable)
- JetBrains Mono (local, for dashboard numbers)

---

## 📚 References

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Lighthouse Scoring](https://web.dev/performance-scoring/)

---

## ✅ Success Criteria

### Metrics to Track

1. **Conversion Rate:** Visitors → Waitlist signups (Target: 5-10%)
2. **Bounce Rate:** <40%
3. **Time on Page:** >2 minutes
4. **Scroll Depth:** >80% reach final CTA
5. **Performance Score:** 90+ (Lighthouse)
6. **Accessibility Score:** 100 (Lighthouse)

### User Feedback

- Qualitative feedback from early visitors
- Hotjar session recordings
- Exit surveys (optional)

---

## 🆘 Troubleshooting

### Common Issues

1. **Dashboard preview not loading:**
   - Check image paths
   - Verify Next.js Image optimization
   - Check browser console for errors

2. **Animations not triggering:**
   - Verify Intersection Observer setup
   - Check scroll position calculations
   - Test on different browsers

3. **Waitlist form not submitting:**
   - Check API endpoint logs
   - Verify database connection
   - Test email validation

4. **Mobile layout issues:**
   - Test on real devices, not just DevTools
   - Check touch event handling
   - Verify viewport meta tag

---

## 📞 Support

For questions or issues during implementation:
- Review this document thoroughly
- Check component source code in existing dashboard
- Test incrementally (don't build everything at once)
- Use browser DevTools for debugging

---

## 🎯 Quick Start Summary

**For immediate prelaunch lock implementation:**

1. **Update middleware** (`src/middleware.ts`):
   - Add prelaunch lock check at top
   - Only allow `/` and `/api/waitlist`
   - Redirect everything else to landing page

2. **Create waitlist API** (`src/app/api/waitlist/route.ts`):
   - Use Supabase service role key
   - Validate email server-side
   - Handle duplicates gracefully

3. **Run database migration**:
   - Create `waitlist_submissions` table in Supabase

4. **Set environment variable**:
   - Railway: `PRELAUNCH_LOCK=true`
   - Local: `PRELAUNCH_LOCK=true` in `.env.local`

5. **Create landing page** (`src/app/page.tsx`):
   - Replace existing root redirect
   - Simple form with email input
   - No navigation to sign-in/sign-up

6. **Test security thoroughly**:
   - Verify all routes except `/` redirect to landing
   - Verify sign-in/sign-up inaccessible
   - Test waitlist submission end-to-end

**To launch (disable prelaunch lock):**
- Set `PRELAUNCH_LOCK=false` in Railway
- Deploy
- Root `/` will redirect to sign-in as normal
- All auth pages become accessible

---

**Estimated Timeline:** 12 days for full implementation (security first)
**Priority:** High (prelaunch landing page + idea validation)
**Status:** Ready for implementation
**Security Model:** Prelaunch lock via middleware + environment variable

---

Last updated: October 6, 2025

