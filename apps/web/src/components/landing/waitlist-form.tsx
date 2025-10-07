"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useWaitlist } from "@/hooks/use-waitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPosthogClientBrowser } from "@nexus/analytics/client";

interface WaitlistFormProps {
  inline?: boolean;
  className?: string;
}

/**
 * Waitlist form component for landing page
 * Supports both inline (hero) and full-width (final CTA) layouts
 */
export function WaitlistForm({ inline = false, className }: WaitlistFormProps) {
  const { subscribe, isLoading, error, success } = useWaitlist();
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Track form submission attempt
    const posthog = getPosthogClientBrowser();
    if (posthog) {
      posthog.capture("waitlist_form_submitted", {
        page_section: inline ? "hero" : "final_cta",
        email_domain: email.split("@")[1],
      });
    }

    await subscribe(email);
  };

  if (success) {
    return (
      <div
        className={cn(
          "rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 text-center",
          className
        )}
      >
        <Check className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
        <p className="text-green-700 dark:text-green-300 font-medium">
          You&apos;re on the list! Be on the lookout for an email for early access!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn(inline ? "flex gap-2" : "space-y-4", className)}>
      <div className={cn(inline && "flex-1")}>
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full"
          disabled={isLoading}
          aria-label="Email address"
        />
      </div>

      <Button
        type="submit"
        size={inline ? "default" : "lg"}
        disabled={isLoading}
        className="whitespace-nowrap"
      >
        {isLoading ? "Joining..." : "Join Waitlist"}
      </Button>

      {error && (
        <p className={cn("text-sm text-red-600 dark:text-red-400", inline ? "col-span-2" : "mt-2")}>
          {error}
        </p>
      )}
    </form>
  );
}
