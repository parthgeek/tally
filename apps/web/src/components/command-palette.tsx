"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Home, Receipt, TrendingUp, Eye, Settings, DollarSign, Search, ArrowRight, FileText } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  // Register Cmd+K / Ctrl+K shortcut
  useKeyboardShortcut({
    key: "k",
    meta: true, // Cmd on Mac
    handler: () => setOpen(true),
    description: "Open command palette",
  });

  // Also support Ctrl+K for Windows/Linux
  useKeyboardShortcut({
    key: "k",
    ctrl: true,
    handler: () => setOpen(true),
    description: "Open command palette",
  });

  const commands: CommandItem[] = [
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      icon: Home,
      onSelect: () => {
        router.push("/dashboard");
        setOpen(false);
      },
      keywords: ["home", "overview", "metrics"],
    },
    {
      id: "nav-transactions",
      label: "Go to Transactions",
      icon: Receipt,
      onSelect: () => {
        router.push("/transactions");
        setOpen(false);
      },
      keywords: ["list", "all", "view"],
    },
    {
      id: "nav-receipts",
      label: "Go to Receipts",
      icon: FileText,
      onSelect: () => {
        router.push("/receipts");
        setOpen(false);
      },
      keywords: ["documents", "papers", "files", "invoices"],
    },
    {
      id: "nav-pl",
      label: "Go to P&L",
      icon: TrendingUp,
      onSelect: () => {
        router.push("/pl");
        setOpen(false);
      },
      keywords: ["profit", "loss", "income", "statement", "financial"],
    },
    {
      id: "nav-review",
      label: "Go to Review Queue",
      icon: Eye,
      onSelect: () => {
        router.push("/review");
        setOpen(false);
      },
      keywords: ["needs review", "categorize", "approve"],
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      icon: Settings,
      onSelect: () => {
        router.push("/settings");
        setOpen(false);
      },
      keywords: ["preferences", "config", "account"],
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {commands.map((command) => {
            const Icon = command.icon;
            return (
              <CommandItem
                key={command.id}
                value={`${command.label} ${command.keywords?.join(" ") || ""}`}
                onSelect={command.onSelect}
                className="cursor-pointer"
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{command.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 opacity-50" />
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="View all transactions"
            onSelect={() => {
              router.push("/transactions");
              setOpen(false);
            }}
            className="cursor-pointer"
          >
            <DollarSign className="mr-2 h-4 w-4" />
            <span>View all transactions</span>
          </CommandItem>
          <CommandItem
            value="View all receipts"
            onSelect={() => {
              router.push("/receipts");
              setOpen(false);
            }}
            className="cursor-pointer"
          >
            <FileText className="mr-2 h-4 w-4" />
            <span>View all receipts</span>
          </CommandItem>
          <CommandItem
            value="Review queue"
            onSelect={() => {
              router.push("/review");
              setOpen(false);
            }}
            className="cursor-pointer"
          >
            <Eye className="mr-2 h-4 w-4" />
            <span>Review pending transactions</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}