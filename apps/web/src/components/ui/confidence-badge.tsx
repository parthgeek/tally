import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: number | null;
  size?: "sm" | "md";
  className?: string;
}

export function ConfidenceBadge({ confidence, size = "md", className }: ConfidenceBadgeProps) {
  if (confidence === null) return null;

  const level = confidence >= 0.95 ? "high" : confidence >= 0.75 ? "medium" : "low";

  const styles = {
    high: "bg-confidence-high-bg text-confidence-high-fg",
    medium: "bg-confidence-medium-bg text-confidence-medium-fg",
    low: "bg-confidence-low-bg text-confidence-low-fg",
  };

  const labels = {
    high: "High",
    medium: "Med",
    low: "Low",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-tiny font-medium",
        styles[level],
        size === "sm" && "px-1.5 py-0",
        className
      )}
      title={`Confidence: ${Math.round(confidence * 100)}%`}
    >
      {labels[level]}
    </span>
  );
}
