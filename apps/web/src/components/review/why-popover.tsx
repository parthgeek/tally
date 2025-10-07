import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Brain, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReviewTransactionItem } from "@nexus/types";

interface WhyPopoverProps {
  transaction: ReviewTransactionItem;
}

export function WhyPopover({ transaction }: WhyPopoverProps) {
  if (!transaction.confidence || transaction.why.length === 0) {
    return null;
  }

  const confidence = Math.round(transaction.confidence * 100);
  const isLowConfidence = confidence < 70;
  const isMediumConfidence = confidence >= 70 && confidence < 90;
  const isHighConfidence = confidence >= 90;

  const confidenceColor = isLowConfidence
    ? "bg-red-100 text-red-800 border-red-200"
    : isMediumConfidence
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-green-100 text-green-800 border-green-200";

  const getSourceIcon = () => {
    switch (transaction.decision_source) {
      case "pass1":
        return <Zap className="h-3 w-3" />;
      case "llm":
        return <Brain className="h-3 w-3" />;
      default:
        return <HelpCircle className="h-3 w-3" />;
    }
  };

  const getSourceLabel = () => {
    switch (transaction.decision_source) {
      case "pass1":
        return "Rules-based";
      case "llm":
        return "AI Classification";
      default:
        return "Unknown";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto px-1 py-0.5">
          <Badge
            variant="outline"
            className={cn("h-5 px-1.5 text-xs font-medium", confidenceColor)}
          >
            {confidence}%
          </Badge>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Why this category?</h4>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {getSourceIcon()}
              {getSourceLabel()}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Confidence:</span>
            <Badge variant="outline" className={cn("h-5 px-2 text-xs", confidenceColor)}>
              {confidence}%
            </Badge>
          </div>

          <div className="space-y-2">
            <h5 className="text-sm font-medium">Reasoning:</h5>
            {transaction.why.map((reason, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                <p className="text-sm text-muted-foreground">{reason}</p>
              </div>
            ))}
          </div>

          {transaction.decision_source === "pass1" && (
            <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
              <div className="flex items-center gap-1 mb-1">
                <Zap className="h-3 w-3" />
                Rule-based classification
              </div>
              This transaction was categorized using predefined rules based on merchant patterns and
              transaction codes.
            </div>
          )}

          {transaction.decision_source === "llm" && (
            <div className="text-xs text-muted-foreground bg-purple-50 p-2 rounded">
              <div className="flex items-center gap-1 mb-1">
                <Brain className="h-3 w-3" />
                AI-powered classification
              </div>
              This transaction was categorized using our AI model that analyzes transaction context
              and patterns.
            </div>
          )}

          {transaction.decision_created_at && (
            <div className="text-xs text-muted-foreground border-t pt-2">
              Classified on {new Date(transaction.decision_created_at).toLocaleDateString()} at{" "}
              {new Date(transaction.decision_created_at).toLocaleTimeString()}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
