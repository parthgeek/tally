import type { Metadata } from "next";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FAQSection } from "@/components/landing/faq-section";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

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
          <FeatureShowcase />
          <ProblemSection />
          <HowItWorks />
          <FAQSection />
          <FinalCTA />
        </main>

        <Footer />
      </div>
    </>
  );
}
