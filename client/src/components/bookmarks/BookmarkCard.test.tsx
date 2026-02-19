import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BookmarkCard from "./BookmarkCard";
import type { Bookmark } from "../../lib/api";

const mockBookmark: Bookmark = {
  id: "123",
  text: "This is a test bookmark about TypeScript",
  author_id: "user1",
  author_username: "testuser",
  author_name: "Test User",
  tweet_url: "https://x.com/testuser/status/123",
  created_at: new Date().toISOString(),
  conversation_id: null,
  likes: 1500,
  retweets: 200,
  replies: 50,
  quotes: 10,
  impressions: 50000,
  bookmark_count: 5,
  urls: [],
  mentions: [],
  hashtags: [],
  category_id: null,
  notes: "",
  is_pinned: false,
  bookmarked_at: new Date().toISOString(),
  synced_at: new Date().toISOString(),
  tags: [{ id: 1, name: "TypeScript", color: "#3178c6" }],
};

describe("BookmarkCard", () => {
  it("renders author username", () => {
    render(<BookmarkCard bookmark={mockBookmark} />);
    expect(screen.getByText("@testuser")).toBeInTheDocument();
  });

  it("renders tweet text with t.co URLs cleaned", () => {
    const withTco = {
      ...mockBookmark,
      text: "Check this out https://t.co/abc123",
    };
    render(<BookmarkCard bookmark={withTco} />);
    expect(screen.getByText("Check this out")).toBeInTheDocument();
  });

  it("renders tags", () => {
    render(<BookmarkCard bookmark={mockBookmark} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("renders compact metrics", () => {
    render(<BookmarkCard bookmark={mockBookmark} />);
    expect(screen.getByText("1.5K")).toBeInTheDocument();
    expect(screen.getByText("50.0K")).toBeInTheDocument();
  });

  it("calls onBookmarkClick when clicked", () => {
    const onClick = vi.fn();
    render(<BookmarkCard bookmark={mockBookmark} onBookmarkClick={onClick} />);
    fireEvent.click(screen.getByText("@testuser").closest("div")!.parentElement!);
    expect(onClick).toHaveBeenCalledWith("123");
  });

  it("shows checkbox when selectable", () => {
    render(
      <BookmarkCard
        bookmark={mockBookmark}
        selectable
        selected={false}
        onSelect={vi.fn()}
      />
    );
    // The checkbox container should exist
    const card = screen.getByText("@testuser").closest("div")!.parentElement!;
    expect(card.querySelector(".absolute")).toBeTruthy();
  });

  it("applies selected styling when selected", () => {
    render(
      <BookmarkCard
        bookmark={mockBookmark}
        selectable
        selected={true}
        onSelect={vi.fn()}
      />
    );
    const card = screen.getByText("@testuser").closest("div")!.parentElement!;
    expect(card.className).toContain("border-accent");
  });

  it("calls onSelect instead of onBookmarkClick when selectable", () => {
    const onSelect = vi.fn();
    const onBookmarkClick = vi.fn();
    render(
      <BookmarkCard
        bookmark={mockBookmark}
        selectable
        selected={false}
        onSelect={onSelect}
        onBookmarkClick={onBookmarkClick}
      />
    );
    fireEvent.click(screen.getByText("@testuser").closest("div")!.parentElement!);
    expect(onSelect).toHaveBeenCalledWith("123");
    expect(onBookmarkClick).not.toHaveBeenCalled();
  });

  it("renders without tags when tags array is empty", () => {
    const noTags = { ...mockBookmark, tags: [] };
    render(<BookmarkCard bookmark={noTags} />);
    expect(screen.queryByText("TypeScript")).toBeNull();
  });
});
