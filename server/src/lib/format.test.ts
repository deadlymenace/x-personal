import { describe, it, expect } from "vitest";
import {
  formatTweetTelegram,
  formatTweetMarkdown,
  formatResultsTelegram,
  formatProfileTelegram,
} from "./format.js";
import type { Tweet } from "./api.js";

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
  return {
    id: "123456",
    text: "This is a test tweet about TypeScript https://t.co/abc123",
    author_id: "user1",
    username: "testuser",
    name: "Test User",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    conversation_id: "123456",
    metrics: {
      likes: 1500,
      retweets: 200,
      replies: 50,
      quotes: 10,
      impressions: 50000,
      bookmarks: 5,
    },
    urls: ["https://example.com"],
    mentions: [],
    hashtags: [],
    tweet_url: "https://x.com/testuser/status/123456",
    ...overrides,
  };
}

describe("formatTweetTelegram", () => {
  it("formats a tweet with username and metrics", () => {
    const result = formatTweetTelegram(makeTweet());
    expect(result).toContain("@testuser");
    expect(result).toContain("1.5K likes");
    expect(result).toContain("50.0K views");
  });

  it("cleans t.co URLs from text", () => {
    const result = formatTweetTelegram(makeTweet());
    expect(result).not.toContain("t.co");
  });

  it("includes index prefix when provided", () => {
    const result = formatTweetTelegram(makeTweet(), 0);
    expect(result).toMatch(/^1\. /);
  });

  it("includes the tweet URL", () => {
    const result = formatTweetTelegram(makeTweet());
    expect(result).toContain("https://x.com/testuser/status/123456");
  });

  it("includes first URL from urls array", () => {
    const result = formatTweetTelegram(makeTweet());
    expect(result).toContain("https://example.com");
  });

  it("truncates long text without full option", () => {
    const longText = "A".repeat(250);
    const result = formatTweetTelegram(makeTweet({ text: longText }));
    expect(result).toContain("...");
  });

  it("shows full text with full option", () => {
    const longText = "A".repeat(250);
    const result = formatTweetTelegram(makeTweet({ text: longText }), undefined, {
      full: true,
    });
    expect(result).toContain(longText);
  });
});

describe("formatTweetMarkdown", () => {
  it("formats tweet as markdown with bold username", () => {
    const result = formatTweetMarkdown(makeTweet());
    expect(result).toContain("**@testuser**");
  });

  it("includes tweet link", () => {
    const result = formatTweetMarkdown(makeTweet());
    expect(result).toContain("[Tweet]");
    expect(result).toContain("https://x.com/testuser/status/123456");
  });

  it("includes engagement metrics", () => {
    const result = formatTweetMarkdown(makeTweet());
    expect(result).toContain("1500L");
    expect(result).toContain("50000I");
  });

  it("includes links section when urls present", () => {
    const result = formatTweetMarkdown(makeTweet());
    expect(result).toContain("Links:");
    expect(result).toContain("example.com");
  });
});

describe("formatResultsTelegram", () => {
  it("formats multiple tweets with indices", () => {
    const tweets = [makeTweet({ id: "1" }), makeTweet({ id: "2" })];
    const result = formatResultsTelegram(tweets);
    expect(result).toContain("1. @testuser");
    expect(result).toContain("2. @testuser");
  });

  it("includes query header when provided", () => {
    const tweets = [makeTweet()];
    const result = formatResultsTelegram(tweets, { query: "TypeScript" });
    expect(result).toContain('"TypeScript"');
  });

  it("limits output and shows overflow count", () => {
    const tweets = Array.from({ length: 20 }, (_, i) =>
      makeTweet({ id: String(i) })
    );
    const result = formatResultsTelegram(tweets, { limit: 5 });
    expect(result).toContain("+15 more");
  });
});

describe("formatProfileTelegram", () => {
  it("formats user profile with metrics", () => {
    const user = {
      username: "testuser",
      name: "Test User",
      description: "A test account",
      public_metrics: { followers_count: 5000, tweet_count: 1200 },
    };
    const tweets = [makeTweet()];
    const result = formatProfileTelegram(user, tweets);
    expect(result).toContain("@testuser");
    expect(result).toContain("5.0K followers");
    expect(result).toContain("1.2K tweets");
    expect(result).toContain("A test account");
  });
});
