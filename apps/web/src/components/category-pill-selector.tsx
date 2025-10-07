"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryPill, type CategoryTier1 } from "@/components/ui/category-pill";

// Map category type to tier1
function getCategoryTier1(categoryType?: string | null): CategoryTier1 {
  if (!categoryType) return null;
  if (categoryType === "revenue") return "revenue";
  if (categoryType === "cogs") return "cogs";
  if (categoryType === "opex") return "opex";
  return null;
}

export interface Category {
  id: string;
  name: string;
  type?: string | null;
}

interface CategoryPillSelectorProps {
  categories: Category[];
  value?: string | null;
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function CategoryPillSelector({
  categories,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select category...",
  className,
}: CategoryPillSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedCategory = categories.find((cat) => cat.id === value);
  const tier1 = getCategoryTier1(selectedCategory?.type);

  const filteredCategories = React.useMemo(() => {
    if (!searchQuery) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter((cat) => cat.name.toLowerCase().includes(query));
  }, [categories, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between border-border-subtle hover:bg-muted/50",
            !value && "text-muted-foreground",
            className
          )}
        >
          {value && selectedCategory ? (
            <CategoryPill tier1={tier1} tier2={selectedCategory.name} size="sm" />
          ) : (
            <span className="text-sm">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b border-border-subtle px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {/* Uncategorized option */}
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onValueChange(null);
                  setOpen(false);
                  setSearchQuery("");
                }}
                className="cursor-pointer"
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">Uncategorized</span>
              </CommandItem>

              {/* Category options */}
              {filteredCategories.map((category) => {
                const catTier1 = getCategoryTier1(category.type);
                return (
                  <CommandItem
                    key={category.id}
                    value={category.id}
                    onSelect={(currentValue) => {
                      onValueChange(currentValue === value ? null : currentValue);
                      setOpen(false);
                      setSearchQuery("");
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === category.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <CategoryPill tier1={catTier1} tier2={category.name} size="sm" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
