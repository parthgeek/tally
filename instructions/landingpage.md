# Landing Page Implementation Plan

## 📋 Overview

**Objective:** Build a minimalist, high-converting landing page for Tally that mirrors Beluga Labs' structure and design patterns, showcasing key features and capturing waitlist signups during prelaunch validation phase.

**Target URL:** `/` (root landing page)

**Design Inspiration:** Beluga Labs (belugalabs.ai) - Clean, modern, numbered feature showcase

**Key Requirements:**
- Minimalist design matching existing app aesthetic
- Hero section with bold text (no dashboard visual)
- Numbered feature showcase with visuals (Beluga-style)
- Waitlist email capture (no pricing, no testimonials, no social proof)
- **PRELAUNCH LOCK: No access to any other pages (including sign-in/sign-up)**
- Mobile-first responsive design
- Fast load times (<2s)
- Accessibility compliant (WCAG 2.1 AA)

---

## 🎯 Scope

### Included Sections (6 Total)
1. **Hero Section** - Big bold tagline + waitlist CTA (no dashboard visual)
2. **Feature Showcase** - 5 numbered features with visuals (Beluga-style carousel)
3. **How It Works** - 3-step process
4. **FAQ** - Accordion-style questions (specific questions TBD)
5. **Final CTA** - Waitlist signup with email input
6. **Footer** - Comprehensive footer with links

### Excluded
- Social proof/testimonials
- Pricing section
- Problem section (before/after comparison)
- Dashboard preview in hero
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

**Note:** App is **dark-only**. Light mode has been removed entirely. All color tokens default to dark values.

### Color Palette (Dark Minimalist - Supabase-inspired with Purple)

```css
/* Dark Mode (Primary Theme) */
--background: 220 15% 12%;         /* Deep charcoal */
--foreground: 0 0% 95%;             /* Soft white */
--card: 220 14% 14%;               /* Slightly lighter charcoal */
--primary: 265 89% 76%;            /* Bright purple (#A78BFA) */
--muted: 220 12% 18%;              /* Dark muted surface */
--border: 220 16% 22%;             /* Subtle border on dark */
--accent: 268 45% 22%;             /* Dark purple accent */

/* Category Colors (Dark Mode) */
--revenue-bg: 210 100% 20%;        /* Dark blue */
--revenue-fg: 210 100% 75%;        /* Light blue */
--cogs-bg: 33 100% 20%;            /* Dark orange */
--cogs-fg: 33 100% 75%;            /* Light orange */
--opex-bg: 270 100% 20%;           /* Dark purple */
--opex-fg: 270 100% 75%;           /* Light purple */

/* Semantic Colors */
--success: 142 65% 52%;            /* Green */
--warning: 38 92% 55%;             /* Amber */
--destructive: 0 78% 58%;          /* Red */
```

### Typography

```
Font Family:
- Sans: Inter (with ligatures: "rlig", "calt", "ss01")
- Mono: JetBrains Mono (for numbers/dashboard data)

Scale:
- Display: 56px/64px, font-bold (Hero headline)
- H1: 36px/44px, font-bold
- H2: 32px/40px, font-semibold
- H3: 24px/32px, font-semibold
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
│   ├── page.tsx                  # Landing page at root
│   └── api/
│       └── waitlist/
│           └── route.ts          # Waitlist API endpoint (POST only)
├── components/
│   └── landing/                  # Landing page components
│       ├── hero-section.tsx
│       ├── feature-showcase.tsx   # Numbered feature carousel
│       ├── feature-slide.tsx      # Individual feature slide
│       ├── how-it-works.tsx
│       ├── faq-section.tsx
│       ├── waitlist-form.tsx
│       ├── final-cta.tsx
│       └── navigation.tsx
├── middleware.ts                 # CRITICAL: Updated with prelaunch lock
├── lib/
│   └── waitlist.ts               # Waitlist utilities
└── hooks/
    └── use-waitlist.ts           # Waitlist form hook
```

---

## 🏗️ Component Breakdown

### 1. Hero Section (`hero-section.tsx`)

**Purpose:** Capture attention immediately with bold tagline and clear value proposition. **NO dashboard visual** - text-focused like Beluga.

**Structure:**
```tsx
<section className="relative min-h-screen pt-32 pb-16">
  <div className="container mx-auto px-6">
    <div className="max-w-4xl mx-auto text-center">
      {/* Big Bold Headline */}
      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
        [Tagline TBD - Engaging, Clever]
      </h1>
      
      {/* Supporting Text */}
      <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
        Real-time P&L, automated COGS tracking, and tax-ready exports. Built for Shopify stores.
      </p>
      
      {/* Waitlist Form */}
      <div className="max-w-md mx-auto mb-8">
        <WaitlistForm inline />
      </div>
      
      {/* Trust Badges */}
      <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span>SOC 2 Compliant</span>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span>95%+ Accuracy</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span>Powered by Gemini</span>
        </div>
      </div>
    </div>
  </div>
  
  {/* Scroll Indicator */}
  <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
    <button
      onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
      className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
      aria-label="Scroll to features"
    >
      <span className="text-sm">Explore Features</span>
      <ChevronDown className="w-5 h-5 animate-bounce" />
    </button>
  </div>
</section>
```

**Key Features:**
- Centered, text-focused layout (no dashboard preview)
- Large, bold headline (56-72px on desktop)
- Supporting paragraph with value proposition
- Inline waitlist form
- Trust badges at bottom
- Smooth scroll indicator

**Styling:**
- Background: `bg-background` or subtle gradient
- Text: `text-foreground` with high contrast
- Headline: Large, bold, tracking-tight
- Generous whitespace

---

### 2. Feature Showcase (`feature-showcase.tsx`)

**Purpose:** Showcase 5 key features with numbered slides (Beluga-style). Large visuals with navigation pills.

**Structure:**
```tsx
<section id="features" className="py-24 bg-muted/30">
  <div className="container mx-auto px-6">
    {/* Section Header */}
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-bold">
        What You Get with Tally
      </h2>
    </div>
    
    {/* Navigation Pills */}
    <div className="flex justify-center gap-2 mb-12 flex-wrap">
      {features.map((feature, index) => (
        <button
          key={feature.id}
          onClick={() => setActiveIndex(index)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-colors",
            activeIndex === index
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border hover:bg-muted"
          )}
        >
          {feature.shortTitle}
        </button>
      ))}
    </div>
    
    {/* Active Feature Display */}
    <div className="max-w-6xl mx-auto">
      {features.map((feature, index) => (
        <div
          key={feature.id}
          className={cn(
            "grid md:grid-cols-2 gap-12 items-center",
            activeIndex !== index && "hidden"
          )}
        >
          {/* Left: Content */}
          <div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
              <span className="text-2xl font-bold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>/</span>
              <span>{String(features.length).padStart(2, '0')}</span>
            </div>
            
            <h3 className="text-3xl font-bold mb-4">
              {feature.headline}
            </h3>
            
            <p className="text-lg text-muted-foreground">
              {feature.description}
            </p>
          </div>
          
          {/* Right: Visual */}
          <div className="rounded-xl border border-border overflow-hidden shadow-notion-xl">
            <img 
              src={feature.imageSrc} 
              alt={feature.headline}
              className="w-full h-auto"
            />
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
```

**Features to Showcase (5 Total):**

1. **Real-time P&L** (Similar to Beluga's "Know What's Safe to Spend")
   - **Headline:** "Know What's Safe to Spend."
   - **Description:** "Your actual take-home after taxes, updated live. Finally, a number you can trust when making decisions."
   - **Visual:** Dashboard screenshot showing real-time P&L metrics
   - **Image:** `/features/real-time-pl.png`

2. **Categorization That Gets Smarter** (Similar to Beluga's "Schedule C: Ready by Design")
   - **Headline:** "Categorization That Gets Smarter."
   - **Description:** "AI learns from your corrections. Every expense sorted into IRS categories automatically. We catch the deductions you'd miss."
   - **Visual:** Transaction list showing AI categorization with confidence scores
   - **Image:** `/features/smart-categorization.png`

3. **Receipts or It Didn't Happen** (Same as Beluga's feature)
   - **Headline:** "Receipts or It Didn't Happen."
   - **Description:** "Attach receipts directly to transactions. Keep your records organized and audit-ready."
   - **Visual:** Receipt attachment interface with transaction details
   - **Image:** `/features/receipt-attachment.png`

4. **Shopify Payout Reconciliation**
   - **Headline:** "Shopify Payouts, Decoded."
   - **Description:** "Automatically separate fees, refunds, and net revenue. Every penny accounted for with real-time payout reconciliation."
   - **Visual:** Shopify payout breakdown table showing fee separation
   - **Image:** `/features/shopify-reconciliation.png`

5. **Export to Accountant**
   - **Headline:** "Export to Accountant, Ready."
   - **Description:** "Tax-ready exports in one click. Compatible with QuickBooks, Xero, or CSV. Your accountant will thank you."
   - **Visual:** Export interface showing multiple format options
   - **Image:** `/features/export-options.png`

**Carousel Behavior:**
- Navigation pills at top (like Beluga)
- Large featured visual on right
- Numbered indicator (01/05, 02/05, etc.)
- Smooth transitions between slides
- Keyboard navigation (arrow keys)
- Touch swipe enabled on mobile

---

### 3. How It Works (`how-it-works.tsx`)

**Purpose:** Show simple 3-step onboarding process.

**Structure:**
```tsx
<section id="how-it-works" className="py-24">
  <div className="container mx-auto px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl font-bold mb-4">
        How It Works
      </h2>
      <p className="text-xl text-muted-foreground">
        Get set up in minutes
      </p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      <StepCard
        number={1}
        title="Connect Accounts"
        description="Link your Shopify store and bank accounts via Plaid. 30 seconds and you're done."
        icon={<Link className="w-8 h-8" />}
      />
      
      <StepCard
        number={2}
        title="See What's Yours"
        description="AI categorizes your transactions automatically. Review your actual profit after taxes, updated live."
        icon={<Eye className="w-8 h-8" />}
      />
      
      <StepCard
        number={3}
        title="Export"
        description="Export tax-ready data for QuickBooks, Xero, or CSV. One-click exports anytime."
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
  
  <div className="relative bg-card border border-border rounded-xl p-8 shadow-md hover:shadow-lg transition-shadow">
    {/* Step number */}
    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
      {number}
    </div>
    
    {/* Icon */}
    <div className="text-primary mb-4">{icon}</div>
    
    {/* Content */}
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
</div>
```

**Animation:**
- Steps fade in sequentially on scroll (200ms stagger)
- Connector lines draw from left to right
- Hover: Card lifts slightly with shadow increase

---

### 4. FAQ Section (`faq-section.tsx`)

**Purpose:** Build trust and answer common questions.

**Structure:**
```tsx
<section id="faq" className="py-24 bg-muted/30">
  <div className="container mx-auto px-6">
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-muted-foreground">
          Everything you need to know about getting started with Tally
        </p>
      </div>
      
      <div className="space-y-4">
        {faqs.map((faq) => (
          <details
            key={faq.id}
            className="group border border-border rounded-lg p-6 bg-card hover:shadow-md transition-shadow"
          >
            <summary className="font-semibold cursor-pointer flex justify-between items-center">
              <span>{faq.question}</span>
              <ChevronDown className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform" />
            </summary>
            <p className="mt-4 text-muted-foreground">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  </div>
</section>
```

**FAQ Questions:** (To be determined later)
- Structure ready, specific questions TBD

**Styling:**
- Accordion-style with `<details>` element
- Smooth expand/collapse animation
- Chevron icon rotates on open

---

### 5. Final CTA (`final-cta.tsx`)

**Purpose:** Convert visitors to waitlist signups.

**Structure:**
```tsx
<section id="waitlist" className="py-24">
  <div className="container mx-auto px-6">
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="text-4xl md:text-5xl font-bold mb-6">
        Finally, Finances That Make Sense
      </h2>
      <p className="text-xl text-muted-foreground mb-8">
        Join the waitlist and be first to know when we launch
      </p>
      
      {/* Waitlist form */}
      <WaitlistForm />
      
      {/* Trust signals */}
      <div className="flex justify-center gap-8 mt-8 text-sm text-muted-foreground flex-wrap">
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

### 6. Waitlist Form (`waitlist-form.tsx`)

**Purpose:** Capture email addresses for waitlist.

**Structure:**
```tsx
'use client';

import { useState } from 'react';
import { useWaitlist } from '@/hooks/use-waitlist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';

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

### 7. Navigation (`navigation.tsx`)

**Purpose:** Simple header navigation (prelaunch mode - no auth links).

**Structure:**
```tsx
<nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
  <div className="container mx-auto px-6">
    <div className="flex items-center justify-between h-16">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-xl">Tally</span>
      </div>
      
      {/* Desktop Nav - Only anchor links during prelaunch */}
      <div className="hidden md:flex items-center gap-6">
        <a
          href="#features"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="text-sm hover:text-primary transition-colors"
        >
          Features
        </a>
        <a
          href="#how-it-works"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="text-sm hover:text-primary transition-colors"
        >
          How It Works
        </a>
        <a
          href="#faq"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="text-sm hover:text-primary transition-colors"
        >
          FAQ
        </a>
        <Button size="sm" asChild>
          <a href="#waitlist" onClick={(e) => {
            e.preventDefault();
            document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Join Waitlist
          </a>
        </Button>
      </div>
      
      {/* Mobile: Just CTA */}
      <Button size="sm" className="md:hidden" asChild>
        <a href="#waitlist" onClick={(e) => {
          e.preventDefault();
          document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
        }}>
          Join Waitlist
        </a>
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

---

### 8. Footer (`footer.tsx`)

**Purpose:** Comprehensive footer with links and legal information.

**Structure:**
```tsx
<footer className="border-t border-border py-12 bg-muted/30">
  <div className="container mx-auto px-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
      {/* Brand Column */}
      <div>
        <h3 className="font-bold text-xl mb-4">Tally</h3>
        <p className="text-sm text-muted-foreground">
          AI-powered bookkeeping for e-commerce brands
        </p>
      </div>
      
      {/* Product Column */}
      <div>
        <h4 className="font-semibold mb-4">Product</h4>
        <nav className="space-y-2">
          <a href="#features" className="block text-sm text-muted-foreground hover:text-primary">
            Features
          </a>
          <a href="#how-it-works" className="block text-sm text-muted-foreground hover:text-primary">
            How It Works
          </a>
          <a href="#faq" className="block text-sm text-muted-foreground hover:text-primary">
            FAQ
          </a>
        </nav>
      </div>
      
      {/* Company Column */}
      <div>
        <h4 className="font-semibold mb-4">Company</h4>
        <nav className="space-y-2">
          <a href="#" className="block text-sm text-muted-foreground hover:text-primary">
            About
          </a>
          <a href="#" className="block text-sm text-muted-foreground hover:text-primary">
            Contact
          </a>
        </nav>
      </div>
      
      {/* Legal Column */}
      <div>
        <h4 className="font-semibold mb-4">Legal</h4>
        <nav className="space-y-2">
          <a href="#" className="block text-sm text-muted-foreground hover:text-primary">
            Privacy Policy
          </a>
          <a href="#" className="block text-sm text-muted-foreground hover:text-primary">
            Terms of Service
          </a>
        </nav>
      </div>
    </div>
    
    <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
      <p>© 2025 Tally. All rights reserved.</p>
    </div>
  </div>
</footer>
```

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
  // ... existing auth logic ...
  
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
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
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
- Stacked hero (centered text)
- Feature carousel with swipe
- Larger tap targets (min 44px)
- Reduced padding (24px vs 32px)
- Smaller typography (36px headlines vs 56px)

// Tablet (640px - 1024px):
- 2 column feature display
- Side-by-side feature showcase
- Medium padding

// Desktop (1024px+):
- Full 2 column feature showcase
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

1. **Hero Section:**
   - Fade in on load
   - Headline animates word by word (optional)

2. **Feature Showcase:**
   - Slide transition between features (300ms)
   - Visual fades in on feature change
   - Navigation pills highlight smoothly

3. **How It Works:**
   - Steps fade in sequentially on scroll (200ms stagger)
   - Connector lines draw from left to right
   - Hover: Card lifts slightly with shadow increase

4. **FAQ:**
   - Smooth expand/collapse (150ms)
   - Chevron rotates smoothly

5. **Waitlist Form:**
   - Success: Checkmark animation (300ms)
   - Error: Shake animation (300ms)
   - Loading: Button spinner

### Performance Considerations

- Use `will-change` sparingly
- Prefer `transform` and `opacity` (GPU-accelerated)
- `requestAnimationFrame` for scroll animations
- Lazy load images below fold
- Preload hero images

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
  src="/features/real-time-pl.png"
  alt="Real-time P&L Dashboard"
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

const FeatureShowcase = dynamic(
  () => import('@/components/landing/feature-showcase'),
  { loading: () => <FeatureShowcaseSkeleton /> }
);
```

### Lighthouse Goals

- Performance: 90+
- Accessibility: 100
- Best Practices: 100
- SEO: 100

---

## 🔍 SEO Implementation

### Meta Tags

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tally | AI-Powered Bookkeeping for E-Commerce Brands',
  description: 'Automated bookkeeping for Shopify stores. Real-time P&L, COGS tracking, and tax-ready exports. Built for e-commerce.',
  keywords: 'shopify bookkeeping, ecommerce accounting, online store bookkeeping, automated bookkeeping, shopify accounting',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Tally | AI-Powered Bookkeeping for E-Commerce Brands',
    description: 'Automated bookkeeping for Shopify stores.',
    siteName: 'Tally',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tally | AI-Powered Bookkeeping for E-Commerce Brands',
    description: 'Automated bookkeeping for Shopify stores.',
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

### Structured Data

```tsx
export default function LandingPage() {
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Tally',
    applicationCategory: 'BusinessApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: 'AI-powered bookkeeping for e-commerce brands',
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
'feature_slide_viewed' // Track which feature slide is viewed
'feature_navigation_clicked'
'cta_button_clicked'
'navigation_link_clicked'
'faq_item_opened'

// Properties to include
{
  page_section: 'hero' | 'features' | 'how_it_works' | 'faq' | 'final_cta',
  feature_name: string, // for feature slides
  error_message: string, // for errors
  email_domain: string, // for waitlist (e.g., 'gmail.com')
}
```

---

## 🧪 Testing Checklist

### Security Testing (CRITICAL - Test First)

**Prelaunch Lock Verification:**
- [ ] Set `PRELAUNCH_LOCK=true` in environment
- [ ] Visit `/` - should show landing page ✅
- [ ] Visit `/sign-in` - should redirect to `/` ✅
- [ ] Visit `/dashboard` - should redirect to `/` ✅
- [ ] POST to `/api/waitlist` - should work ✅
- [ ] POST to `/api/transactions` - should return 404 ✅

**Waitlist Functionality:**
- [ ] Submit valid email - saves to database
- [ ] Submit duplicate email - handles gracefully
- [ ] Submit invalid email - shows error
- [ ] Check Supabase `waitlist_submissions` table for entries

### Manual Testing

- [ ] All sections render correctly on mobile/tablet/desktop
- [ ] Feature carousel navigation works smoothly
- [ ] Feature slides transition properly
- [ ] Waitlist form validates email
- [ ] Waitlist form shows success state
- [ ] Navigation links scroll to sections smoothly
- [ ] FAQ accordion expands/collapses correctly
- [ ] Images load with proper blur placeholders
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works throughout
- [ ] Screen reader announces content properly

### Performance Testing

- [ ] Lighthouse score: 90+ performance
- [ ] First Contentful Paint: <1.8s
- [ ] Largest Contentful Paint: <2.5s
- [ ] Cumulative Layout Shift: <0.1
- [ ] Time to Interactive: <3.8s

---

## 📝 Detailed Implementation Plan

**⚠️ Important:** After completing each phase, commit and push changes to GitHub before proceeding to the next phase. This ensures incremental progress tracking and makes it easier to roll back if needed.

---

### Phase 0: Foundation & Theme Setup (Day 1 - Priority)

**Objective:** Set up dark minimalist purple theme and force dark mode globally.

#### Task 1: Update Color Palette
**File:** `apps/web/src/app/globals.css`

**Changes:**
- Update `.dark` section with new purple primary color
- Update all dark mode color variables to match Supabase-inspired palette
- Keep light mode variables for backwards compatibility (but won't be used)

```css
.dark {
  /* Base */
  --background: 220 15% 12%;
  --foreground: 0 0% 95%;

  /* Cards & Surfaces */
  --card: 220 14% 14%;
  --card-foreground: 0 0% 95%;

  /* Popovers */
  --popover: 220 14% 14%;
  --popover-foreground: 0 0% 95%;

  /* Interactive - Purple Primary */
  --primary: 265 89% 76%;
  --primary-foreground: 255 85% 12%;

  /* Secondary */
  --secondary: 220 12% 18%;
  --secondary-foreground: 0 0% 95%;

  /* Muted */
  --muted: 220 12% 18%;
  --muted-foreground: 220 10% 65%;

  /* Accent */
  --accent: 268 45% 22%;
  --accent-foreground: 270 80% 85%;

  /* Semantic Colors */
  --destructive: 0 78% 58%;
  --destructive-foreground: 0 0% 100%;
  --destructive-background: 0 84% 20%;

  --success: 142 65% 52%;
  --success-foreground: 0 0% 100%;
  --success-background: 142 71% 20%;

  --warning: 38 92% 55%;
  --warning-foreground: 24 10% 10%;
  --warning-background: 38 92% 20%;

  /* Borders */
  --border: 220 16% 22%;
  --border-subtle: 220 14% 20%;
  --input: 220 16% 22%;
  --ring: 265 89% 76%;

  /* Category Pills - dark mode */
  --revenue-bg: 210 100% 20%;
  --revenue-fg: 210 100% 75%;
  --cogs-bg: 33 100% 20%;
  --cogs-fg: 33 100% 75%;
  --opex-bg: 270 100% 20%;
  --opex-fg: 270 100% 75%;

  /* Confidence Tags - dark mode */
  --confidence-high-bg: 142 71% 20%;
  --confidence-high-fg: 142 71% 75%;
  --confidence-medium-bg: 48 96% 20%;
  --confidence-medium-fg: 48 96% 75%;
  --confidence-low-bg: 0 84% 20%;
  --confidence-low-fg: 0 84% 75%;
}
```

#### Task 2: Force Dark Mode Globally
**File:** `apps/web/src/app/layout.tsx`

**Changes:**
- Add `className="dark"` to `<html>` element

```tsx
<html lang="en" className="dark">
```

**Dependencies:** None
**Testing:** Verify dark theme appears immediately on page load

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx
git commit -m "feat: Phase 0 - Dark minimalist purple theme setup"
git push
```

---

### Phase 1: Hero Section Refactor (Day 2)

**Objective:** Transform hero from dashboard preview layout to centered text-focused layout (Beluga-style).

#### Task 1: Refactor Hero Section Component
**File:** `apps/web/src/components/landing/hero-section.tsx`

**Changes:**
- Remove dashboard preview import and usage
- Change layout from 2-column grid to centered single column
- Update styling for dark theme with subtle purple glow
- Add scroll indicator

**Key Changes:**
```tsx
// Remove:
import { DashboardPreview } from "./dashboard-preview";
<div className="order-first lg:order-last">
  <DashboardPreview />
</div>

// Replace with centered layout:
<section className="relative min-h-screen pt-32 pb-16 bg-background">
  <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_50%_-10%,hsl(var(--primary)/0.15),transparent)]" />
  <div className="container mx-auto px-6">
    <div className="max-w-4xl mx-auto text-center">
      {/* Big Bold Headline */}
      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
        [Tagline TBD - Engaging, Clever]
      </h1>
      {/* ... rest of centered content */}
    </div>
  </div>
</section>
```

**Dependencies:** Phase 0 complete
**Testing:** Verify centered layout, purple glow effect, scroll indicator works

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/components/landing/hero-section.tsx
git commit -m "feat: Phase 1 - Hero section refactor (centered text layout)"
git push
```

---

### Phase 2: Feature Showcase Component (Day 3-4)

**Objective:** Create Beluga-style numbered feature carousel with navigation pills.

#### Task 1: Create Feature Showcase Component
**File:** `apps/web/src/components/landing/feature-showcase.tsx` (NEW)

**Structure:**
- State management for active slide index
- Navigation pills component
- Feature slide component with numbered indicator
- Smooth transitions between slides

**Features Array:**
```typescript
const features = [
  {
    id: 'real-time-pl',
    shortTitle: 'Real-time P&L',
    headline: 'Know What's Safe to Spend.',
    description: 'Your actual take-home after taxes, updated live. Finally, a number you can trust when making decisions.',
    imageSrc: '/features/real-time-pl.png',
  },
  {
    id: 'smart-categorization',
    shortTitle: 'Smart Categorization',
    headline: 'Categorization That Gets Smarter.',
    description: 'AI learns from your corrections. Every expense sorted into IRS categories automatically. We catch the deductions you'd miss.',
    imageSrc: '/features/smart-categorization.png',
  },
  {
    id: 'receipts',
    shortTitle: 'Receipts',
    headline: 'Receipts or It Didn't Happen.',
    description: 'Attach receipts directly to transactions. Keep your records organized and audit-ready.',
    imageSrc: '/features/receipt-attachment.png',
  },
  {
    id: 'shopify-reconciliation',
    shortTitle: 'Shopify Recon',
    headline: 'Shopify Payouts, Decoded.',
    description: 'Automatically separate fees, refunds, and net revenue. Every penny accounted for with real-time payout reconciliation.',
    imageSrc: '/features/shopify-reconciliation.png',
  },
  {
    id: 'export',
    shortTitle: 'Export',
    headline: 'Export to Accountant, Ready.',
    description: 'Tax-ready exports in one click. Compatible with QuickBooks, Xero, or CSV. Your accountant will thank you.',
    imageSrc: '/features/export-options.png',
  },
];
```

**Dependencies:** Phase 0 complete
**Testing:** Verify navigation pills work, slides transition smoothly, images load

#### Task 2: Create Feature Slide Component
**File:** `apps/web/src/components/landing/feature-slide.tsx` (NEW)

**Structure:**
- Left column: Number indicator (01/05), headline, description
- Right column: Large feature image
- Responsive: stacks on mobile

**Dependencies:** Phase 2 Task 1
**Testing:** Verify responsive layout, image optimization

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/components/landing/feature-showcase.tsx apps/web/src/components/landing/feature-slide.tsx
git commit -m "feat: Phase 2 - Beluga-style numbered feature showcase"
git push
```

---

### Phase 3: Update How It Works Section (Day 5)

**Objective:** Update existing component to match new 3-step structure.

#### Task 1: Update How It Works Component
**File:** `apps/web/src/components/landing/how-it-works.tsx`

**Changes:**
- Update steps to: Connect Accounts, See What's Yours, Export
- Update icons and descriptions
- Ensure dark theme styling
- Add connector lines for desktop

**New Steps:**
```typescript
const steps = [
  {
    number: 1,
    title: 'Connect Accounts',
    description: 'Link your Shopify store and bank accounts via Plaid. 30 seconds and you're done.',
    icon: Link,
  },
  {
    number: 2,
    title: 'See What's Yours',
    description: 'AI categorizes your transactions automatically. Review your actual profit after taxes, updated live.',
    icon: Eye,
  },
  {
    number: 3,
    title: 'Export',
    description: 'Export tax-ready data for QuickBooks, Xero, or CSV. One-click exports anytime.',
    icon: Download,
  },
];
```

**Dependencies:** Phase 0 complete
**Testing:** Verify steps display correctly, connector lines show on desktop

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/components/landing/how-it-works.tsx
git commit -m "feat: Phase 3 - Update How It Works section (3-step structure)"
git push
```

---

### Phase 4: Create FAQ Section (Day 6)

**Objective:** Build accordion-style FAQ section with questions based on customer concerns.

#### Task 1: Create FAQ Component
**File:** `apps/web/src/components/landing/faq-section.tsx` (NEW)

**Structure:**
- Use `<details>` element for native accordion behavior
- Questions from research (only features we have):
  1. How do you connect to my bank and is it secure?
  2. What data do you pull from Shopify today?
  3. How accurate is categorization and can I correct it?
  4. How long until I see my numbers after connecting?
  5. Can I upload and attach receipts to transactions?
  6. What happens if a bank connection breaks?
  7. Who owns my data?
  8. Do you support multiple bank accounts and institutions?
  9. Can I review low-confidence categorizations in one place?
  10. What file types do you accept for receipts?

**Styling:**
- Dark theme with borders
- Smooth expand/collapse animation
- Chevron icon rotation

**Dependencies:** Phase 0 complete
**Testing:** Verify accordion expands/collapses, animations work

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/components/landing/faq-section.tsx
git commit -m "feat: Phase 4 - FAQ accordion section with customer questions"
git push
```

---

### Phase 5: Update Final CTA & Footer (Day 7)

**Objective:** Enhance final CTA and create comprehensive footer.

#### Task 1: Update Final CTA Component
**File:** `apps/web/src/components/landing/final-cta.tsx`

**Changes:**
- Update copy to match Beluga style
- Add trust signals
- Ensure dark theme styling
- Add subtle purple glow background

**Dependencies:** Phase 0 complete
**Testing:** Verify CTA displays correctly, trust signals show

#### Task 2: Create Comprehensive Footer
**File:** `apps/web/src/components/landing/footer.tsx` (NEW)

**Structure:**
- 4-column grid (desktop): Brand, Product, Company, Legal
- Links to sections and external pages
- Copyright at bottom
- Dark theme styling

**Dependencies:** Phase 0 complete
**Testing:** Verify footer links work, responsive layout

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/components/landing/final-cta.tsx apps/web/src/components/landing/footer.tsx
git commit -m "feat: Phase 5 - Final CTA and comprehensive footer"
git push
```

---

### Phase 6: Update Navigation & Page Structure (Day 8)

**Objective:** Update navigation with FAQ link and restructure landing page.

#### Task 1: Update Navigation Component
**File:** `apps/web/src/components/landing/navigation.tsx`

**Changes:**
- Add FAQ link to navigation
- Ensure dark theme styling
- Update smooth scroll handlers

**Dependencies:** Phase 4 complete
**Testing:** Verify all navigation links work, smooth scroll functions

#### Task 2: Update Landing Page Structure
**File:** `apps/web/src/app/page.tsx`

**Changes:**
- Remove ProblemSection import and usage
- Add FeatureShowcase component
- Add FAQ section
- Add Footer component
- Update section order

**New Structure:**
```tsx
<main>
  <HeroSection />
  <FeatureShowcase />
  <HowItWorks />
  <FAQSection />
  <FinalCTA />
</main>
<Footer />
```

**Dependencies:** All previous phases
**Testing:** Verify all sections render in correct order

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/components/landing/navigation.tsx apps/web/src/app/page.tsx
git commit -m "feat: Phase 6 - Update navigation and landing page structure"
git push
```

---

### Phase 7: Remove Unused Components (Day 8)

**Objective:** Clean up components no longer needed.

#### Task 1: Remove Problem Section
**File:** `apps/web/src/components/landing/problem-section.tsx`

**Action:** Delete file (no longer needed)

#### Task 2: Remove Dashboard Preview (if standalone)
**File:** `apps/web/src/components/landing/dashboard-preview.tsx`

**Action:** Delete file (no longer used in hero)

**Dependencies:** Phase 1 complete (hero refactored)
**Testing:** Verify no broken imports

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git rm apps/web/src/components/landing/problem-section.tsx apps/web/src/components/landing/dashboard-preview.tsx
git commit -m "feat: Phase 7 - Remove unused components"
git push
```

---

### Phase 8: Dark Theme Polish & Animations (Day 9)

**Objective:** Add Supabase-style subtle animations and polish dark theme.

#### Task 1: Add Subtle Animations
**Files:** All landing page components

**Changes:**
- Add scroll-triggered fade-in animations
- Add hover states with subtle shadows
- Add purple glow effects on key sections
- Smooth transitions between feature slides

**Implementation:**
- Use `framer-motion` or Intersection Observer
- Respect `prefers-reduced-motion`

#### Task 2: Polish Dark Theme Styling
**Files:** All landing page components

**Changes:**
- Ensure all backgrounds use `bg-background` or `bg-card`
- Update borders to use `border-border`
- Add subtle purple accents where appropriate
- Verify contrast ratios meet WCAG AA

**Dependencies:** All previous phases
**Testing:** Verify animations work, accessibility passes

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/components/landing/
git commit -m "feat: Phase 8 - Dark theme polish and animations"
git push
```

---

### Phase 9: Responsive Design & Mobile Optimization (Day 10)

**Objective:** Ensure perfect mobile experience.

#### Task 1: Mobile Optimization
**Files:** All landing page components

**Changes:**
- Test and adjust breakpoints
- Optimize feature showcase for mobile swipe
- Ensure navigation pills wrap properly
- Test waitlist form on mobile
- Verify touch targets are ≥44px

**Dependencies:** All previous phases
**Testing:** Test on real devices, not just DevTools

**✅ Phase Complete:** After testing, commit and push to GitHub:
```bash
git add apps/web/src/components/landing/
git commit -m "feat: Phase 9 - Mobile optimization and responsive design"
git push
```

---

### Phase 10: Final QA & Launch Prep (Day 11-12)

**Objective:** Final testing and deployment preparation.

#### Task 1: Accessibility Audit
- Test keyboard navigation
- Verify screen reader compatibility
- Check color contrast ratios
- Test with `prefers-reduced-motion`

#### Task 2: Performance Optimization
- Optimize images (use Next.js Image component)
- Lazy load below-fold components
- Test Lighthouse scores (target: 90+)

#### Task 3: Browser Testing
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

#### Task 4: Security Verification (CRITICAL)
- Verify prelaunch lock middleware works
- Test all routes redirect to `/` when lock enabled
- Verify waitlist API works
- Test authentication is blocked

**Dependencies:** All previous phases
**Testing:** Comprehensive manual and automated testing

**✅ Phase Complete:** After all testing passes, commit and push final changes to GitHub:
```bash
git add .
git commit -m "feat: Phase 10 - Final QA and launch prep complete"
git push
```

---

## 📋 Implementation Checklist Summary

### Foundation (Day 1)
- [ ] Update color palette in `globals.css` (dark purple theme)
- [ ] Force dark mode in `layout.tsx`
- [ ] Verify dark theme applies globally

### Components (Day 2-8)
- [ ] Refactor hero section (remove dashboard, center text)
- [ ] Create feature showcase component
- [ ] Create feature slide component
- [ ] Update how it works section
- [ ] Create FAQ section
- [ ] Update final CTA
- [ ] Create comprehensive footer
- [ ] Update navigation
- [ ] Update page structure
- [ ] Remove unused components

### Polish (Day 9-10)
- [ ] Add scroll animations
- [ ] Polish dark theme styling
- [ ] Mobile optimization
- [ ] Responsive design testing

### Launch Prep (Day 11-12)
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Browser testing
- [ ] Security verification
- [ ] Final QA

---

## 🎨 Design Assets Needed

### Images

- [ ] Logo (SVG, multiple sizes)
- [ ] Feature visual 1: Real-time P&L dashboard (`/features/real-time-pl.png`)
- [ ] Feature visual 2: Smart categorization (`/features/smart-categorization.png`)
- [ ] Feature visual 3: Receipt attachment (`/features/receipt-attachment.png`)
- [ ] Feature visual 4: Shopify reconciliation (`/features/shopify-reconciliation.png`)
- [ ] Feature visual 5: Export options (`/features/export-options.png`)
- [ ] OG image (1200x630px)
- [ ] Favicon (ICO, PNG, SVG)
- [ ] Apple touch icon (180x180px)

### Icons

Using Lucide React (already installed):
- ChevronDown, Shield, Target, Zap, Link, Eye, Download, Check, Lock

---

## ✅ Success Criteria

### Metrics to Track

1. **Conversion Rate:** Visitors → Waitlist signups (Target: 5-10%)
2. **Bounce Rate:** <40%
3. **Time on Page:** >2 minutes
4. **Scroll Depth:** >80% reach final CTA
5. **Performance Score:** 90+ (Lighthouse)
6. **Accessibility Score:** 100 (Lighthouse)

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
   - Hero section (text-focused)
   - Feature showcase (5 features)
   - How it works (3 steps)
   - FAQ section
   - Final CTA
   - Footer

6. **Test security thoroughly**:
   - Verify all routes except `/` redirect to landing
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

Last updated: January 2025
