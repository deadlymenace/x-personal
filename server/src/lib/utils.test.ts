import { describe, it, expect } from "vitest";
import { parseSince, sortBy, filterEngagement, dedupe } from "./api.js";
import type { Tweet } from "./api.js";

function makeTweet(
  id: string,
  metrics?: Partial<Tweet["metrics"]>
): Tweet {
  return {
    id,
    text: "test tweet",
    author_id: "a",
    username: "u",
    name: "n",
    created_at: new Date().toISOString(),
    conversation_id: id,
    metrics: {
      likes: 0,
      retweets: 0,
      replies: 0,
      quotes: 0,
      impressions: 0,
      bookmarks: 0,
      ...metrics,
    },
    urls: [],
    mentions: [],
    hashtags: [],
    tweet_url: `https://x.com/u/status/${id}`,
  };
}

describe("parseSince", () => {
  it("parses minute-based relative time", () => {
    const result = parseSince("30m");
    expect(result).toBeTruthy();
    const parsed = new Date(result!);
    const diffMs = Date.now() - parsed.getTime();
    expect(diffMs).toBeGreaterThan(29 * 60_000);
    expect(diffMs).toBeLessThan(31 * 60_000);
  });

  it("parses hour-based relative time", () => {
    const result = parseSince("24h");
    expect(result).toBeTruthy();
    const parsed = new Date(result!);
    const diffMs = Date.now() - parsed.getTime();
    expect(diffMs).toBeGreaterThan(23 * 3_600_000);
    expect(diffMs).toBeLessThan(25 * 3_600_000);
  });

  it("parses day-based relative time", () => {
    const result = parseSince("7d");
    expect(result).toBeTruthy();
    const parsed = new Date(result!);
    const diffMs = Date.now() - parsed.getTime();
    expect(diffMs).toBeGreaterThan(6 * 86_400_000);
    expect(diffMs).toBeLessThan(8 * 86_400_000);
  });

  it("parses ISO date strings", () => {
    const result = parseSince("2024-01-01T00:00:00Z");
    expect(result).toBe("2024-01-01T00:00:00.000Z");
  });

  it("parses date-only strings", () => {
    const result = parseSince("2024-06-15");
    expect(result).toBeTruthy();
    expect(result).toContain("2024-06-15");
  });

  it("returns null for invalid input", () => {
    expect(parseSince("invalid")).toBeNull();
    expect(parseSince("abc123")).toBeNull();
  });
});

describe("sortBy", () => {
  const tweets = [
    makeTweet("1", { likes: 100 }),
    makeTweet("2", { likes: 500 }),
    makeTweet("3", { likes: 50 }),
  ];

  it("sorts by likes descending", () => {
    const sorted = sortBy(tweets, "likes");
    expect(sorted[0].id).toBe("2");
    expect(sorted[1].id).toBe("1");
    expect(sorted[2].id).toBe("3");
  });

  it("sorts by impressions", () => {
    const tweetsWithViews = [
      makeTweet("1", { impressions: 1000 }),
      makeTweet("2", { impressions: 5000 }),
      makeTweet("3", { impressions: 100 }),
    ];
    const sorted = sortBy(tweetsWithViews, "impressions");
    expect(sorted[0].id).toBe("2");
    expect(sorted[2].id).toBe("3");
  });

  it("does not mutate original array", () => {
    const original = [...tweets];
    sortBy(tweets, "likes");
    expect(tweets[0].id).toBe(original[0].id);
  });
});

describe("filterEngagement", () => {
  const tweets = [
    makeTweet("1", { likes: 100, impressions: 5000 }),
    makeTweet("2", { likes: 10, impressions: 500 }),
    makeTweet("3", { likes: 500, impressions: 50000 }),
  ];

  it("filters by minimum likes", () => {
    const filtered = filterEngagement(tweets, { minLikes: 50 });
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("filters by minimum impressions", () => {
    const filtered = filterEngagement(tweets, { minImpressions: 1000 });
    expect(filtered).toHaveLength(2);
    expect(filtered.map((t) => t.id)).toEqual(["1", "3"]);
  });

  it("filters by both criteria", () => {
    const filtered = filterEngagement(tweets, {
      minLikes: 200,
      minImpressions: 10000,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("3");
  });

  it("returns all tweets when no filters", () => {
    const filtered = filterEngagement(tweets, {});
    expect(filtered).toHaveLength(3);
  });
});

describe("dedupe", () => {
  it("removes duplicate tweets by id", () => {
    const tweets = [makeTweet("1"), makeTweet("2"), makeTweet("1")];
    const result = dedupe(tweets);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("preserves first occurrence of duplicates", () => {
    const first = makeTweet("1");
    first.text = "first";
    const second = makeTweet("1");
    second.text = "second";
    const result = dedupe([first, second]);
    expect(result[0].text).toBe("first");
  });

  it("handles empty array", () => {
    expect(dedupe([])).toEqual([]);
  });

  it("handles array with no duplicates", () => {
    const tweets = [makeTweet("1"), makeTweet("2"), makeTweet("3")];
    expect(dedupe(tweets)).toHaveLength(3);
  });
});
