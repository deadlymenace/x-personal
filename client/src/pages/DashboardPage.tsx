import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Bookmark,
  Tag,
  FolderOpen,
  Clock,
  Search,
} from "lucide-react";
import { useBookmarkStats } from "../hooks/use-bookmarks";
import { useBookmarks } from "../hooks/use-bookmarks";
import { compactNumber, timeAgo } from "../lib/utils";
import BookmarkCard from "../components/bookmarks/BookmarkCard";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: stats, isLoading: statsLoading } = useBookmarkStats();
  const { data: recentBookmarks, isLoading: bookmarksLoading } = useBookmarks({
    page: "1",
    limit: "6",
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/bookmarks?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const statCards = [
    {
      icon: Bookmark,
      label: "Total Bookmarks",
      value: stats ? compactNumber(stats.total) : "--",
    },
    {
      icon: Tag,
      label: "Tags",
      value: stats ? compactNumber(stats.tagCount) : "--",
    },
    {
      icon: FolderOpen,
      label: "Categories",
      value: stats ? compactNumber(stats.categoryCount) : "--",
    },
    {
      icon: Clock,
      label: "Last Synced",
      value: stats?.lastSync ? timeAgo(stats.lastSync) : "Never",
    },
  ];

  const maxTagCount =
    stats?.topTags && stats.topTags.length > 0
      ? Math.max(...stats.topTags.map((t) => t.count))
      : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface rounded-xl p-4 border border-border"
              >
                <div className="w-10 h-10 rounded-full bg-surface-hover animate-pulse" />
                <div className="h-7 w-16 bg-surface-hover rounded animate-pulse mt-2" />
                <div className="h-4 w-24 bg-surface-hover rounded animate-pulse mt-1" />
              </div>
            ))
          : statCards.map((card) => (
              <div
                key={card.label}
                className="bg-surface rounded-xl p-4 border border-border"
              >
                <div className="w-10 h-10 rounded-full bg-accent-muted flex items-center justify-center">
                  <card.icon className="w-5 h-5 text-accent" />
                </div>
                <div className="text-2xl font-bold text-text-primary mt-2">
                  {card.value}
                </div>
                <div className="text-sm text-text-secondary">{card.label}</div>
              </div>
            ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder="Search bookmarks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-full bg-surface border border-border rounded-lg h-10 pl-10 pr-4 text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Recent Bookmarks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-text-primary">
            Recent Bookmarks
          </h2>
          <Link
            to="/bookmarks"
            className="text-sm text-accent hover:text-accent-hover transition-colors"
          >
            View All
          </Link>
        </div>
        {bookmarksLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface rounded-xl p-4 border border-border space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-surface-hover animate-pulse" />
                  <div className="h-4 w-24 bg-surface-hover rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-surface-hover rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-surface-hover rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-12 bg-surface-hover rounded animate-pulse" />
                  <div className="h-5 w-16 bg-surface-hover rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : recentBookmarks && recentBookmarks.data.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {recentBookmarks.data.map((bookmark) => (
              <BookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            <Bookmark className="w-8 h-8 text-text-secondary mx-auto mb-2" />
            <p className="text-text-secondary text-sm">
              No bookmarks yet. Sync your X bookmarks to get started.
            </p>
          </div>
        )}
      </div>

      {/* Top Tags */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">
          Top Tags
        </h2>
        {statsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-20 bg-surface-hover rounded animate-pulse" />
                <div className="flex-1 h-6 bg-surface-hover rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : stats?.topTags && stats.topTags.length > 0 ? (
          <div className="space-y-2">
            {stats.topTags.map((tag) => (
              <div key={tag.name} className="flex items-center gap-3">
                <span className="text-sm text-text-primary w-28 truncate shrink-0">
                  {tag.name}
                </span>
                <div className="flex-1 h-6 bg-surface rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.max((tag.count / maxTagCount) * 100, 4)}%`,
                      backgroundColor: tag.color || "#1d9bf0",
                    }}
                  />
                </div>
                <span className="text-sm text-text-secondary w-10 text-right shrink-0">
                  {tag.count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-secondary text-sm">
            No tags yet. Create tags to organize your bookmarks.
          </p>
        )}
      </div>
    </div>
  );
}
