import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdleTimeout } from "./use-idle-timeout";

describe("useIdleTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should trigger onIdle after the timeout", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle, 1000));

    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("should reset the timer on activity", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle, 1000));

    act(() => {
      vi.advanceTimersByTime(500);
      window.dispatchEvent(new MouseEvent("mousemove"));
      vi.advanceTimersByTime(600);
    });

    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("should not trigger if disabled", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimeout(onIdle, 1000, false));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onIdle).not.toHaveBeenCalled();
  });
});
