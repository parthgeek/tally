import Link from "next/link";

/**
 * Comprehensive footer with links and company info
 * 4-column layout on desktop, stacked on mobile
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Tally</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered bookkeeping for e-commerce brands. Know your numbers, make better
              decisions.
            </p>
          </div>

          {/* Product Column */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="#features"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="#waitlist"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Join Waitlist
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="mailto:hello@usetally.app"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@usetally.app"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Support
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© {currentYear} Tally. All rights reserved.</p>
            <p className="text-xs">
              Made with care for e-commerce founders who deserve better tools.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

