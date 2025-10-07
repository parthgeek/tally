import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDashboardAnalytics } from "./use-dashboard-analytics";

// Mock PostHog
const mockCapture = vi.fn();
const mockPostHog = {
  capture: mockCapture,
};

vi.mock("posthog-js/react", () => ({
  usePostHog: () => mockPostHog,
}));

// Mock document.cookie
Object.defineProperty(document, "cookie", {
  writable: true,
  value: "orgId=test-org-123; otherCookie=value",
});

describe("useDashboardAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("extracts orgId from cookie correctly", () => {
    const { result } = renderHook(() => useDashboardAnalytics());

    act(() => {
      result.current.trackDashboardViewed();
    });

    expect(mockCapture).toHaveBeenCalledWith("dashboard_viewed", {
      orgId: "test-org-123",
    });
  });

  test("handles missing orgId cookie", () => {
    // Temporarily override cookie
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "otherCookie=value",
    });

    const { result } = renderHook(() => useDashboardAnalytics());

    act(() => {
      result.current.trackDashboardViewed();
    });

    expect(mockCapture).toHaveBeenCalledWith("dashboard_viewed", {
      orgId: null,
    });

    // Restore cookie for other tests
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "orgId=test-org-123; otherCookie=value",
    });
  });

  test("tracks dashboard viewed event", () => {
    const { result } = renderHook(() => useDashboardAnalytics());

    act(() => {
      result.current.trackDashboardViewed();
    });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith("dashboard_viewed", {
      orgId: "test-org-123",
    });
  });

  test("tracks range toggle event", () => {
    const { result } = renderHook(() => useDashboardAnalytics());

    act(() => {
      result.current.trackRangeToggle("90d");
    });

    expect(mockCapture).toHaveBeenCalledWith("dashboard_toggle_range", {
      range: "90d",
      orgId: "test-org-123",
    });
  });

  test("tracks alert clicked events", () => {
    const { result } = renderHook(() => useDashboardAnalytics());

    act(() => {
      result.current.trackAlertClicked("low_balance");
    });

    expect(mockCapture).toHaveBeenCalledWith("dashboard_alert_clicked", {
      type: "low_balance",
      orgId: "test-org-123",
    });

    act(() => {
      result.current.trackAlertClicked("unusual_spend");
    });

    expect(mockCapture).toHaveBeenCalledWith("dashboard_alert_clicked", {
      type: "unusual_spend",
      orgId: "test-org-123",
    });

    act(() => {
      result.current.trackAlertClicked("needs_review");
    });

    expect(mockCapture).toHaveBeenCalledWith("dashboard_alert_clicked", {
      type: "needs_review",
      orgId: "test-org-123",
    });
  });

  test("throttles chart hover events", () => {
    const { result } = renderHook(() => useDashboardAnalytics());

    // Multiple rapid hover events
    act(() => {
      result.current.trackChartHover("inout");
      result.current.trackChartHover("inout");
      result.current.trackChartHover("top5");
    });

    // Should not have captured yet due to throttling
    expect(mockCapture).not.toHaveBeenCalled();

    // Advance timers by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should capture only the last event
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith("dashboard_chart_hover", {
      chart: "top5", // Last hover event
      orgId: "test-org-123",
    });
  });

  test("handles multiple chart hover events with proper throttling", () => {
    const { result } = renderHook(() => useDashboardAnalytics());

    // First hover
    act(() => {
      result.current.trackChartHover("inout");
    });

    // Advance by 500ms (not enough to trigger)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockCapture).not.toHaveBeenCalled();

    // Second hover (should reset timer)
    act(() => {
      result.current.trackChartHover("trend");
    });

    // Advance by another 500ms (still not enough since timer reset)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockCapture).not.toHaveBeenCalled();

    // Advance by final 500ms (now 1000ms since last hover)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith("dashboard_chart_hover", {
      chart: "trend",
      orgId: "test-org-123",
    });
  });

  test("does not track events when PostHog is unavailable", async () => {
    // Mock PostHog as undefined
    const mockedModule = (await vi.importMock("posthog-js/react")) as any;
    vi.mocked(mockedModule.usePostHog).mockReturnValue(undefined);

    const { result } = renderHook(() => useDashboardAnalytics());

    act(() => {
      result.current.trackDashboardViewed();
      result.current.trackRangeToggle("30d");
      result.current.trackAlertClicked("low_balance");
      result.current.trackChartHover("inout");
    });

    // Advance timers for chart hover
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockCapture).not.toHaveBeenCalled();
  });
});
