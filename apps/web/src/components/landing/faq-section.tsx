"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFadeIn } from "@/hooks/use-fade-in";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How do you connect to my bank and is it secure?",
    answer:
      "We use Plaid, the same technology trusted by Venmo, Robinhood, and thousands of financial apps. Your credentials are never stored on our servers. Plaid uses bank-level 256-bit encryption and is SOC 2 Type II certified. We never have access to move money from your accounts.",
  },
  {
    question: "What data do you pull from Shopify today?",
    answer:
      "We pull orders, refunds, payouts, fees, and tax information from your Shopify store. This includes transaction amounts, dates, customer details, and product information. We sync automatically so your books stay up-to-date in real-time.",
  },
  {
    question: "How accurate is categorization and can I correct it?",
    answer:
      "Our AI categorization is 95%+ accurate out of the box. When you correct a category, the AI learns from your edits and gets smarter over time. You have full control to review and override any categorization decision.",
  },
  {
    question: "How long until I see my numbers after connecting?",
    answer:
      "Initial sync takes 2-5 minutes depending on your transaction volume. After that, new transactions appear in real-time as they happen. Your P&L updates live throughout the day.",
  },
  {
    question: "Can I upload and attach receipts to transactions?",
    answer:
      "Yes! You can attach receipts (PDF, JPG, PNG) directly to any transaction. This keeps your records organized and audit-ready. We support drag-and-drop uploads for quick attachment.",
  },
  {
    question: "What happens if a bank connection breaks?",
    answer:
      "We'll notify you immediately via email if a connection fails. Most issues are resolved by simply re-authenticating through Plaid. Your historical data remains safe and intact during any connection issues.",
  },
  {
    question: "Who owns my data?",
    answer:
      "You do. Your financial data belongs to you, always. You can export or delete your data at any time. We never sell your data to third parties. See our privacy policy for full details.",
  },
  {
    question: "Do you support multiple bank accounts and institutions?",
    answer:
      "Yes! You can connect as many bank accounts and credit cards as you need. Plaid supports over 12,000 financial institutions across the US and Canada, including all major banks and credit unions.",
  },
  {
    question: "Can I review low-confidence categorizations in one place?",
    answer:
      "Absolutely. Our Review page shows all transactions that need your attention, with low-confidence categorizations highlighted first. You can review and correct them in bulk, and the AI learns from each edit.",
  },
  {
    question: "What file types do you accept for receipts?",
    answer:
      "We accept PDF, JPG, JPEG, PNG, and HEIC files. Maximum file size is 10MB per receipt. You can attach multiple receipts to a single transaction if needed.",
  },
];

function FAQAccordion({ question, answer }: FAQItem) {
  return (
    <details className="group border border-border rounded-lg overflow-hidden bg-card">
      <summary className="flex items-center justify-between gap-4 p-6 cursor-pointer list-none hover:bg-accent/50 transition-colors">
        <h3 className="text-lg font-semibold">{question}</h3>
        <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180 flex-shrink-0" />
      </summary>
      <div className="px-6 pb-6 pt-2 text-muted-foreground border-t border-border">
        <p>{answer}</p>
      </div>
    </details>
  );
}

/**
 * FAQ section with accordion-style questions
 * Questions based on customer concerns about implemented features
 */
export function FAQSection() {
  const { ref, isVisible } = useFadeIn();
  
  return (
    <section
      id="faq"
      ref={ref}
      className={cn(
        "py-16 sm:py-24 bg-background transition-all duration-700",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Everything you need to know about how Tally works
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <FAQAccordion key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>

          {/* Still have questions CTA */}
          <div className="mt-10 sm:mt-12 text-center">
            <p className="text-sm sm:text-base text-muted-foreground mb-4">Still have questions?</p>
            <a
              href="mailto:support@usetally.app"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Get in touch →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

