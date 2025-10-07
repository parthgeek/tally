import { useState, useCallback, useEffect } from "react";
import { KeyboardNavigationState } from "@nexus/types";

interface UseKeyboardNavigationProps {
  totalItems: number;
  onEdit?: (index: number) => void;
  onAccept?: (index: number) => void;
  onAttach?: (index: number) => void;
  onToggleSelection?: (index: number) => void;
}

export function useKeyboardNavigation({
  totalItems,
  onEdit,
  onAccept,
  onAttach,
  onToggleSelection,
}: UseKeyboardNavigationProps) {
  const [state, setState] = useState<KeyboardNavigationState>({
    selectedIndex: 0,
    selectionMode: "single",
  });

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex: Math.min(prev.selectedIndex + 1, totalItems - 1),
          }));
          break;

        case "ArrowUp":
          event.preventDefault();
          setState((prev) => ({
            ...prev,
            selectedIndex: Math.max(prev.selectedIndex - 1, 0),
          }));
          break;

        case "Enter":
          event.preventDefault();
          if (event.shiftKey) {
            // Shift+Enter = Accept transaction as-is
            onAccept?.(state.selectedIndex);
          } else {
            // Enter = Edit category
            onEdit?.(state.selectedIndex);
          }
          break;

        case " ": // Space
          event.preventDefault();
          if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd+Space = Toggle selection
            onToggleSelection?.(state.selectedIndex);
          }
          break;

        case "r":
          if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd+R = Attach receipt
            event.preventDefault();
            onAttach?.(state.selectedIndex);
          }
          break;

        case "Escape":
          // Clear editing state
          setState((prev) => ({
            ...prev,
            editingIndex: undefined,
          }));
          break;
      }
    },
    [state.selectedIndex, totalItems, onEdit, onAccept, onAttach, onToggleSelection]
  );

  // Update selected index when total items changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      selectedIndex: Math.min(prev.selectedIndex, Math.max(0, totalItems - 1)),
    }));
  }, [totalItems]);

  const setSelectedIndex = useCallback(
    (index: number) => {
      setState((prev) => ({
        ...prev,
        selectedIndex: Math.max(0, Math.min(index, totalItems - 1)),
      }));
    },
    [totalItems]
  );

  const setEditingIndex = useCallback((index: number | undefined) => {
    setState((prev) => ({
      ...prev,
      editingIndex: index,
    }));
  }, []);

  return {
    selectedIndex: state.selectedIndex,
    editingIndex: state.editingIndex,
    selectionMode: state.selectionMode,
    handleKeyDown,
    setSelectedIndex,
    setEditingIndex,
  };
}
