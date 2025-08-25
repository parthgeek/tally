"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

export function OrgSwitcher() {
  return (
    <Button variant="outline" className="justify-between w-48">
      <span className="truncate">Select Organization</span>
      <ChevronDown className="ml-2 h-4 w-4" />
    </Button>
  );
}