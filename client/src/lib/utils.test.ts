import { describe, it, expect } from "vitest";
import { compactNumber, timeAgo, cn } from "./utils";

describe("compactNumber", () => {
  it("returns plain number for values under 1000", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(500)).toBe("500");
    expect(compactNumber(999)).toBe("999");
  });

  it("formats thousands with K", () => {
    expect(compactNumber(1000)).toBe("1.0K");
    expect(compactNumber(1500)).toBe("1.5K");
    expect(compactNumber(15000)).toBe("15.0K");
    expect(compactNumber(999999)).toBe("1000.0K");
  });

  it("formats millions with M", () => {
    expect(compactNumber(1_000_000)).toBe("1.0M");
    expect(compactNumber(2_500_000)).toBe("2.5M");
    expect(compactNumber(10_000_000)).toBe("10.0M");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for very recent dates", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns minutes for < 1 hour", () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60_000).toISOString();
    expect(timeAgo(thirtyMinsAgo)).toBe("30m ago");
  });

  it("returns hours for < 24 hours", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3_600_000).toISOString();
    expect(timeAgo(fiveHoursAgo)).toBe("5h ago");
  });

  it("returns days for < 30 days", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(timeAgo(tenDaysAgo)).toBe("10d ago");
  });

  it("returns formatted date for > 30 days", () => {
    const oldDate = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const result = timeAgo(oldDate);
    // Should be a locale date string, not relative
    expect(result).not.toContain("ago");
    expect(result).toContain("/");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    const result = cn("px-4", "py-2");
    expect(result).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    const result = cn("base", true && "active", false && "disabled");
    expect(result).toBe("base active");
  });

  it("merges conflicting tailwind classes", () => {
    const result = cn("px-4", "px-8");
    expect(result).toBe("px-8");
  });
});
