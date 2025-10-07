"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { OrgCreateRequest, orgCreateRequestSchema } from "@nexus/types/contracts";

export default function OnboardingPage() {
  const [formData, setFormData] = useState<OrgCreateRequest>({
    name: "",
    industry: "ecommerce",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    taxYearStart: new Date().getFullYear() + "-01-01",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleInputChange = (field: keyof OrgCreateRequest, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Client-side validation using Zod schema
      const validatedData = orgCreateRequestSchema.parse(formData);

      const response = await fetch("/api/auth/org/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create organization");
      }

      // Success - redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const taxYearOptions = [
    { value: `${currentYear}-01-01`, label: `January 1, ${currentYear}` },
    { value: `${currentYear}-04-01`, label: `April 1, ${currentYear}` },
    { value: `${currentYear}-07-01`, label: `July 1, ${currentYear}` },
    { value: `${currentYear}-10-01`, label: `October 1, ${currentYear}` },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight">
          Set up your organization
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Let&apos;s get started by creating your organization profile
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px]">
        <div className="bg-card px-6 py-12 shadow sm:rounded-lg sm:px-12 border">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-destructive/15 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium leading-6">
                Organization Name *
              </label>
              <div className="mt-2">
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter your business name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="industry" className="block text-sm font-medium leading-6">
                Industry *
              </label>
              <div className="mt-2">
                <select
                  id="industry"
                  name="industry"
                  required
                  value={formData.industry}
                  onChange={(e) => handleInputChange("industry", e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 ring-1 ring-inset ring-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm sm:leading-6"
                >
                  <option value="ecommerce">E-commerce / Online Retail</option>
                  <option value="Retail">Physical Retail</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Professional Services">Professional Services</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium leading-6">
                Timezone *
              </label>
              <div className="mt-2">
                <Input
                  id="timezone"
                  name="timezone"
                  type="text"
                  required
                  value={formData.timezone}
                  onChange={(e) => handleInputChange("timezone", e.target.value)}
                  placeholder="e.g., America/New_York"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ve automatically detected your timezone
              </p>
            </div>

            <div>
              <label htmlFor="taxYearStart" className="block text-sm font-medium leading-6">
                Tax Year Start *
              </label>
              <div className="mt-2">
                <select
                  id="taxYearStart"
                  name="taxYearStart"
                  required
                  value={formData.taxYearStart}
                  onChange={(e) => handleInputChange("taxYearStart", e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 ring-1 ring-inset ring-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm sm:leading-6"
                >
                  {taxYearOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">When does your tax year begin?</p>
            </div>

            <div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating Organization..." : "Create Organization"}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <p className="text-center text-sm text-muted-foreground">
              By creating an organization, you agree to our terms of service
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
