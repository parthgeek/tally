"use client";

import { X, Check } from "lucide-react";

interface ProblemItemProps {
  text: string;
}

function ProblemItem({ text }: ProblemItemProps) {
  return (
    <li className="flex items-start gap-3">
      <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <span className="text-muted-foreground">{text}</span>
    </li>
  );
}

interface SolutionItemProps {
  text: string;
}

function SolutionItem({ text }: SolutionItemProps) {
  return (
    <li className="flex items-start gap-3">
      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </li>
  );
}

/**
 * Problem section showing before/after comparison
 */
export function ProblemSection() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Stop wrestling with spreadsheets</h2>
          <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
            Traditional bookkeeping wasn&apos;t built for e-commerce
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* BEFORE */}
          <div className="relative">
            <div className="absolute -top-4 left-4">
              <span className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-1 rounded-full text-sm font-medium">
                Without Tally
              </span>
            </div>

            <div className="border border-border rounded-xl p-8 bg-card">
              <ul className="space-y-4">
                <ProblemItem text="10+ hours monthly on manual reconciliation" />
                <ProblemItem text="Messy spreadsheets with broken formulas" />
                <ProblemItem text="No idea if you're actually profitable" />
                <ProblemItem text="Tax season panic and expensive CPAs" />
                <ProblemItem text="Payment processor fees buried in 'other'" />
              </ul>
            </div>
          </div>

          {/* AFTER */}
          <div className="relative">
            <div className="absolute -top-4 left-4 z-10">
              <span className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
                With Tally
              </span>
            </div>

            <div className="border-2 border-primary/20 rounded-xl p-8 bg-card ring-2 ring-primary/10">
              <ul className="space-y-4">
                <SolutionItem text="Automated categorization in seconds" />
                <SolutionItem text="Real-time P&L, always up-to-date" />
                <SolutionItem text="Know your margins and unit economics" />
                <SolutionItem text="Tax-ready exports in one click" />
                <SolutionItem text="Every fee tracked and categorized" />
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
