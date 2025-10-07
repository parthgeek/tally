import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeatureCarousel } from "@/components/landing/feature-carousel";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FinalCTA } from "@/components/landing/final-cta";

export const metadata: Metadata = {
  title: "Tally | AI-Powered Bookkeeping for E-Commerce Brands",
  description:
    "Automated bookkeeping for Shopify stores. Real-time P&L, COGS tracking, and tax-ready exports. Built for e-commerce.",
  keywords:
    "shopify bookkeeping, ecommerce accounting, online store bookkeeping, automated bookkeeping, shopify accounting",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Tally | AI-Powered Bookkeeping for E-Commerce Brands",
    description: "Automated bookkeeping for Shopify stores.",
    siteName: "Tally",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tally | AI-Powered Bookkeeping for E-Commerce Brands",
    description: "Automated bookkeeping for Shopify stores.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

/**
 * Landing page (prelaunch mode)
 * Showcases product value and captures waitlist signups
 */
export default function LandingPage() {
  // Structured data for SEO
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tally",
    applicationCategory: "BusinessApplication",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: "AI-powered bookkeeping for e-commerce brands",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <div className="min-h-screen">
        <Navigation />
        <main>
          <HeroSection />
          <FeatureCarousel />
          <ProblemSection />
          <HowItWorks />
          <FinalCTA />
        </main>

        <footer className="border-t border-border py-8">
          <div className="container mx-auto px-6">
            <div className="text-center text-sm text-muted-foreground">
              <p>© 2025 Tally. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
