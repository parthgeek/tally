"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getPosthogClientBrowser } from "@nexus/analytics/client";

/**
 * Landing page navigation component (prelaunch mode - no auth links)
 * Features smooth scroll to page sections with logo
 */
export function Navigation() {
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();

    const targetId = href.substring(1); // Remove '#'
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });

      // Track navigation click
      const posthog = getPosthogClientBrowser();
      if (posthog) {
        posthog.capture("navigation_link_clicked", {
          link: targetId,
        });
      }
    }
  };

  const handleCTAClick = () => {
    const posthog = getPosthogClientBrowser();
    if (posthog) {
      posthog.capture("cta_button_clicked", {
        location: "navigation",
      });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <a href="/" aria-label="Tally Home" className="flex items-center gap-2">
            <Image
              src="/brand/logo-mark.svg"
              alt="Tally logo"
              width={32}
              height={32}
              priority
              className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8"
            />
            <span className="font-bold text-xl sm:text-2xl md:text-3xl tracking-tight">Tally</span>
          </a>

          {/* Desktop Nav - Only anchor links during prelaunch */}
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#features"
              onClick={(e) => handleSmoothScroll(e, "#features")}
              className="text-sm hover:text-primary transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => handleSmoothScroll(e, "#how-it-works")}
              className="text-sm hover:text-primary transition-colors"
            >
              How It Works
            </a>
            <a
              href="#faq"
              onClick={(e) => handleSmoothScroll(e, "#faq")}
              className="text-sm hover:text-primary transition-colors"
            >
              FAQ
            </a>
            <Button size="sm" asChild onClick={handleCTAClick}>
              <a href="#waitlist" onClick={(e) => handleSmoothScroll(e, "#waitlist")}>
                Join Waitlist
              </a>
            </Button>
          </div>

          {/* Mobile: Just CTA */}
          <Button size="sm" className="md:hidden" asChild onClick={handleCTAClick}>
            <a href="#waitlist" onClick={(e) => handleSmoothScroll(e, "#waitlist")}>
              Join Waitlist
            </a>
          </Button>
        </div>
      </div>
    </nav>
  );
}
