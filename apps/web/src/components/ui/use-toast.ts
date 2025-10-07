import { useCallback } from "react";

type ToastVariant = "default" | "destructive";

interface Toast {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

// Simple toast implementation using alerts for now
// In a real app, you'd want a proper toast system
export function useToast() {
  const toast = useCallback((toastData: Toast) => {
    const message = toastData.description
      ? `${toastData.title}\n${toastData.description}`
      : toastData.title;

    if (toastData.variant === "destructive") {
      alert(`Error: ${message}`);
    } else {
      alert(message);
    }
  }, []);

  return { toast };
}
