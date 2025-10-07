import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import type { ReviewTransactionItem, CategoryId } from "@nexus/types";
import type { TransactionCorrectRequest } from "@nexus/types";

interface CategoryCellProps {
  transaction: ReviewTransactionItem;
  onUpdate?: (transaction: ReviewTransactionItem) => void;
  isSelected?: boolean;
  isEditing?: boolean;
  onEdit?: () => void;
}

interface Category {
  id: CategoryId;
  name: string;
}

export function CategoryCell({
  transaction,
  onUpdate,
  isSelected = false,
  isEditing = false,
  onEdit,
}: CategoryCellProps) {
  const [isOpen, setIsOpen] = useState(isEditing);
  const [searchValue, setSearchValue] = useState("");
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Fetch categories for the dropdown (active categories only)
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

  // Helper to get org ID from cookies
  const getCurrentOrgId = () => {
    const cookies = document.cookie.split(";");
    const orgCookie = cookies.find((cookie) => cookie.trim().startsWith("orgId="));
    return orgCookie ? orgCookie.split("=")[1] : null;
  };

  // Mutation to update transaction category
  const correctTransactionMutation = useMutation({
    mutationFn: async (newCategoryId: string) => {
      const request: TransactionCorrectRequest = {
        txId: transaction.id,
        newCategoryId: newCategoryId as any,
      };

      const response = await fetch("/api/transactions/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to correct transaction");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch review data
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-review"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setIsOpen(false);
    },
  });

  const handleCategorySelect = (category: Category) => {
    correctTransactionMutation.mutate(category.id);

    // Optimistically update the local transaction
    if (onUpdate) {
      onUpdate({
        ...transaction,
        category_id: category.id,
        category_name: category.name,
        needs_review: false,
      });
    }
  };

  // Filter categories based on search
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const displayText = transaction.category_name || "Uncategorized";
  const isUncategorized = !transaction.category_name;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-auto min-h-[32px] justify-start text-left font-normal px-2 py-1",
            isSelected && "ring-2 ring-blue-500",
            isUncategorized && "text-muted-foreground",
            correctTransactionMutation.isPending && "opacity-50"
          )}
          onClick={onEdit}
          disabled={correctTransactionMutation.isPending}
        >
          <span className="flex-1 truncate">{displayText}</span>
          {transaction.needs_review && (
            <Badge variant="outline" className="ml-2 h-4 px-1 text-xs">
              Review
            </Badge>
          )}
          <ChevronDown className="ml-2 h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="start">
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
                onSelect={() => handleCategorySelect(category)}
                className="flex items-center justify-between"
              >
                <span>{category.name}</span>
                {category.id === transaction.category_id && <Check className="h-4 w-4" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>

        {correctTransactionMutation.isPending && (
          <div className="border-t p-2 text-center text-sm text-muted-foreground">Saving...</div>
        )}

        {correctTransactionMutation.error && (
          <div className="border-t p-2 text-center text-sm text-red-600">
            {correctTransactionMutation.error.message}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
