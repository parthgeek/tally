import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Card } from "@/components/ui/card";
import { Check, X, Settings, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import type { TransactionBulkCorrectRequest, TransactionId, CategoryId } from "@nexus/types";

interface BulkActionBarProps {
  selectedTransactions: Set<string>;
  onClearSelection: () => void;
  className?: string;
}

interface Category {
  id: string;
  name: string;
}

export function BulkActionBar({
  selectedTransactions,
  onClearSelection,
  className,
}: BulkActionBarProps) {
  const [isCategorizingOpen, setIsCategorizingOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const queryClient = useQueryClient();
  const supabase = createClient();

  const selectedCount = selectedTransactions.size;

  // Helper to get org ID from cookies
  const getCurrentOrgId = () => {
    const cookies = document.cookie.split(";");
    const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
    return orgCookie ? orgCookie.split("=")[1] : null;
  };

  // Fetch categories for bulk correction (active categories only)
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .or("org_id.is.null,org_id.eq." + getCurrentOrgId())
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as Category[];
    },
  });

  // Bulk correction mutation
  const bulkCorrectMutation = useMutation({
    mutationFn: async ({
      categoryId,
      createRule = true,
    }: {
      categoryId: string;
      createRule?: boolean;
    }) => {
      const request: TransactionBulkCorrectRequest = {
        tx_ids: Array.from(selectedTransactions) as TransactionId[],
        new_category_id: categoryId as CategoryId,
        create_rule: createRule,
      };

      const response = await fetch("/api/transactions/bulk-correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to correct transactions");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Clear selection and refresh data
      onClearSelection();
      setIsCategorizingOpen(false);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-review"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      // Show success message
      console.log(`Successfully corrected ${data.corrected_count} transactions`);
    },
  });

  // Accept all transactions as-is
  const handleAcceptAll = () => {
    // Since we're accepting as-is, we don't change categories, just mark as reviewed
    // This would need a separate endpoint or modification to the existing one
    console.log(
      "Accept all functionality would mark transactions as reviewed without changing categories"
    );
  };

  // Bulk categorize with rule creation
  const handleBulkCategorize = (category: Category) => {
    bulkCorrectMutation.mutate({
      categoryId: category.id,
      createRule: true,
    });
  };

  // Filter categories based on search
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Don't render if no transactions selected
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className={cn("fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50", className)}>
      <Card className="bg-white border shadow-lg rounded-lg p-4 min-w-[400px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="h-6 px-2">
              {selectedCount} selected
            </Badge>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleAcceptAll}
                disabled={bulkCorrectMutation.isPending}
                className="h-8"
              >
                <Check className="h-3 w-3 mr-1" />
                Accept All
              </Button>

              <Popover open={isCategorizingOpen} onOpenChange={setIsCategorizingOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkCorrectMutation.isPending}
                    className="h-8"
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Always Categorize Like This
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-80 p-0" align="center">
                  <Command>
                    <CommandInput
                      placeholder="Search categories..."
                      value={searchValue}
                      onValueChange={setSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>No categories found.</CommandEmpty>
                      {filteredCategories.map((category) => (
                        <CommandItem
                          key={category.id}
                          onSelect={() => handleBulkCategorize(category)}
                          className="flex items-center justify-between"
                        >
                          <span>{category.name}</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>

                  {bulkCorrectMutation.isPending && (
                    <div className="border-t p-3 text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        Creating rules and updating transactions...
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Button
                size="sm"
                variant="outline"
                disabled={bulkCorrectMutation.isPending}
                className="h-8"
              >
                <FileText className="h-3 w-3 mr-1" />
                Attach Receipts
              </Button>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            disabled={bulkCorrectMutation.isPending}
            className="h-8 w-8 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {bulkCorrectMutation.error && (
          <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
            {bulkCorrectMutation.error.message}
          </div>
        )}
      </Card>
    </div>
  );
}
