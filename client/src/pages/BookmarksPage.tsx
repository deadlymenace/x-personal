import { useState, useCallback, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  Pin,
  ExternalLink,
  Trash2,
  Download,
  CheckSquare,
} from "lucide-react";
import { cn } from "../lib/utils";
import { timeAgo, compactNumber } from "../lib/utils";
import {
  useBookmarks,
  useUpdateBookmark,
  useDeleteBookmark,
  useBulkDeleteBookmarks,
  useBulkTagBookmarks,
} from "../hooks/use-bookmarks";
import {
  useTags,
  useCategories,
  useAddTagsToBookmark,
  useRemoveTagFromBookmark,
} from "../hooks/use-tags";
import { exportBookmarks } from "../lib/api";
import type { Bookmark, Tag } from "../lib/api";
import BookmarkCard from "../components/bookmarks/BookmarkCard";
import TagBadge from "../components/tags/TagBadge";

export default function BookmarksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(
    null
  );
  const [detailNotes, setDetailNotes] = useState("");
  const [detailCategory, setDetailCategory] = useState<number | null>(null);
  const [detailPinned, setDetailPinned] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const currentPage = searchParams.get("page") || "1";
  const currentSort = searchParams.get("sort") || "bookmarked_at";
  const currentTag = searchParams.get("tag") || "";
  const currentCategory = searchParams.get("category") || "";
  const currentQuery = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(currentQuery);

  const params: Record<string, string> = {
    page: currentPage,
    limit: "12",
    sort: currentSort,
  };
  if (currentQuery) params.q = currentQuery;
  if (currentTag) params.tag = currentTag;
  if (currentCategory) params.category = currentCategory;

  const { data: bookmarksData, isLoading } = useBookmarks(params);
  const { data: tags } = useTags();
  const { data: categories } = useCategories();
  const updateBookmark = useUpdateBookmark();
  const deleteBookmark = useDeleteBookmark();
  const addTags = useAddTagsToBookmark();
  const removeTag = useRemoveTagFromBookmark();
  const bulkDelete = useBulkDeleteBookmarks();
  const bulkTag = useBulkTagBookmarks();

  const hasFilters = currentTag || currentCategory || currentQuery;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!bookmarksData) return;
    setSelectedIds(new Set(bookmarksData.data.map((b) => b.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} bookmark(s)?`)) return;
    bulkDelete.mutate([...selectedIds], { onSuccess: clearSelection });
  };

  const handleBulkTag = (tagId: number) => {
    if (selectedIds.size === 0) return;
    bulkTag.mutate(
      { ids: [...selectedIds], tagIds: [tagId] },
      { onSuccess: clearSelection }
    );
  };

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        if (key !== "page") {
          next.set("page", "1");
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const clearFilters = () => {
    setSearchParams({});
    setSearchInput("");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setParam("q", searchInput.trim());
    }
  };

  const openDetail = (bookmark: Bookmark) => {
    setSelectedBookmark(bookmark);
    setDetailNotes(bookmark.notes || "");
    setDetailCategory(bookmark.category_id);
    setDetailPinned(bookmark.is_pinned);
  };

  const closeDetail = () => {
    setSelectedBookmark(null);
  };

  const saveDetail = () => {
    if (!selectedBookmark) return;
    updateBookmark.mutate(
      {
        id: selectedBookmark.id,
        data: {
          notes: detailNotes,
          category_id: detailCategory,
          is_pinned: detailPinned,
        },
      },
      {
        onSuccess: (updated) => {
          setSelectedBookmark(updated);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedBookmark) return;
    if (!confirm("Delete this bookmark?")) return;
    deleteBookmark.mutate(selectedBookmark.id, {
      onSuccess: () => closeDetail(),
    });
  };

  const handleAddTag = (tagId: number) => {
    if (!selectedBookmark) return;
    addTags.mutate(
      { bookmarkId: selectedBookmark.id, tagIds: [tagId] },
      {
        onSuccess: (updatedTags) => {
          setSelectedBookmark((prev) =>
            prev ? { ...prev, tags: updatedTags } : prev
          );
        },
      }
    );
  };

  const handleRemoveTag = (tagId: number) => {
    if (!selectedBookmark) return;
    removeTag.mutate(
      { bookmarkId: selectedBookmark.id, tagId },
      {
        onSuccess: () => {
          setSelectedBookmark((prev) =>
            prev
              ? { ...prev, tags: prev.tags.filter((t) => t.id !== tagId) }
              : prev
          );
        },
      }
    );
  };

  // Auto-save notes on blur
  useEffect(() => {
    if (selectedBookmark && detailNotes !== selectedBookmark.notes) {
      const timeout = setTimeout(() => {
        saveDetail();
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [detailNotes]);

  const totalPages = bookmarksData?.totalPages || 1;
  const page = bookmarksData?.page || 1;

  const availableTagsForAdd =
    tags?.filter(
      (t) => !selectedBookmark?.tags.some((bt) => bt.id === t.id)
    ) || [];

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className={cn("flex-1 space-y-4", selectedBookmark && "mr-[400px]")}>
        {/* Top Bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full bg-surface border border-border rounded-lg h-10 pl-10 pr-4 text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "grid"
                  ? "bg-accent-muted text-accent"
                  : "bg-surface text-text-secondary hover:text-text-primary"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "list"
                  ? "bg-accent-muted text-accent"
                  : "bg-surface text-text-secondary hover:text-text-primary"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Select Toggle */}
          <button
            onClick={() => {
              if (selectionMode) clearSelection();
              else setSelectionMode(true);
            }}
            className={cn(
              "p-2 rounded-lg border border-border transition-colors",
              selectionMode
                ? "bg-accent-muted text-accent border-accent"
                : "bg-surface text-text-secondary hover:text-text-primary"
            )}
            title="Select bookmarks"
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          {/* Sort Dropdown */}
          <select
            value={currentSort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="bg-surface border border-border rounded-lg h-10 px-3 text-text-primary text-sm outline-none focus:border-accent transition-colors"
          >
            <option value="bookmarked_at">Date Bookmarked</option>
            <option value="likes">Likes</option>
            <option value="impressions">Impressions</option>
            <option value="retweets">Retweets</option>
          </select>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 bg-surface border border-border rounded-lg h-10 px-3 text-text-primary text-sm hover:bg-surface-hover transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-12 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden min-w-[160px]">
                <button
                  onClick={() => {
                    exportBookmarks("json");
                    setShowExportMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => {
                    exportBookmarks("csv");
                    setShowExportMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
                >
                  Export as CSV
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {tags?.map((tag) => (
            <button
              key={tag.id}
              onClick={() =>
                setParam("tag", currentTag === String(tag.id) ? "" : String(tag.id))
              }
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                currentTag === String(tag.id)
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border bg-surface text-text-secondary hover:text-text-primary hover:border-border-hover"
              )}
            >
              {tag.name}
              {tag.bookmark_count !== undefined && (
                <span className="ml-1 opacity-60">{tag.bookmark_count}</span>
              )}
            </button>
          ))}

          {categories && categories.length > 0 && (
            <select
              value={currentCategory}
              onChange={(e) => setParam("category", e.target.value)}
              className="bg-surface border border-border rounded-lg h-8 px-2 text-text-primary text-xs outline-none focus:border-accent transition-colors"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1 rounded-full text-xs font-medium border border-error/30 text-error hover:bg-error/10 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectionMode && (
          <div className="flex items-center gap-3 bg-surface border border-border rounded-lg p-3">
            <span className="text-sm text-text-secondary">
              {selectedIds.size} selected
            </span>
            <button
              onClick={selectAll}
              className="text-sm text-accent hover:underline"
            >
              Select all
            </button>
            <div className="flex-1" />
            <select
              onChange={(e) => {
                if (e.target.value) handleBulkTag(Number(e.target.value));
                e.target.value = "";
              }}
              defaultValue=""
              className="bg-background border border-border rounded-lg h-8 px-2 text-text-primary text-xs outline-none"
            >
              <option value="">Tag selected...</option>
              {tags?.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 text-sm text-error hover:bg-error/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="text-sm text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Bookmarks Grid/List */}
        {isLoading ? (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                : "flex flex-col gap-2"
            )}
          >
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
              </div>
            ))}
          </div>
        ) : bookmarksData && bookmarksData.data.length > 0 ? (
          <div
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                : "flex flex-col gap-2"
            )}
          >
            {bookmarksData.data.map((bookmark) => (
              <div
                key={bookmark.id}
                onClick={() => !selectionMode && openDetail(bookmark)}
                className="cursor-pointer"
              >
                <BookmarkCard
                  bookmark={bookmark}
                  selectable={selectionMode}
                  selected={selectedIds.has(bookmark.id)}
                  onSelect={toggleSelection}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border p-12 text-center">
            <Search className="w-8 h-8 text-text-secondary mx-auto mb-2" />
            <p className="text-text-secondary text-sm">
              No bookmarks found. Try adjusting your filters.
            </p>
          </div>
        )}

        {/* Pagination */}
        {bookmarksData && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                page <= 1
                  ? "bg-surface text-text-secondary cursor-not-allowed"
                  : "bg-surface border border-border text-text-primary hover:bg-surface-hover"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-text-secondary">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setParam("page", String(page + 1))}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                page >= totalPages
                  ? "bg-surface text-text-secondary cursor-not-allowed"
                  : "bg-surface border border-border text-text-primary hover:bg-surface-hover"
              )}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Detail Side Panel */}
      {selectedBookmark && (
        <div className="fixed right-0 top-0 h-full w-[400px] bg-surface border-l border-border z-50 flex flex-col overflow-y-auto">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <h3 className="text-sm font-semibold text-text-primary">
              Bookmark Detail
            </h3>
            <button
              onClick={closeDetail}
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 p-4 space-y-5 overflow-y-auto">
            {/* Author */}
            <div>
              <p className="text-text-primary font-medium">
                {selectedBookmark.author_name}
              </p>
              <p className="text-text-secondary text-sm">
                @{selectedBookmark.author_username}
              </p>
            </div>

            {/* Full Text */}
            <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
              {selectedBookmark.text}
            </p>

            {/* Metrics */}
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span>{compactNumber(selectedBookmark.likes)} likes</span>
              <span>{compactNumber(selectedBookmark.retweets)} RTs</span>
              <span>
                {compactNumber(selectedBookmark.impressions)} views
              </span>
            </div>

            {/* Tags */}
            <div>
              <p className="text-xs text-text-secondary mb-2 font-medium">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedBookmark.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              {availableTagsForAdd.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddTag(Number(e.target.value));
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                  className="bg-surface border border-border rounded-lg h-8 px-2 text-text-secondary text-xs outline-none focus:border-accent transition-colors w-full"
                >
                  <option value="">Add a tag...</option>
                  {availableTagsForAdd.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs text-text-secondary mb-2 font-medium">
                Notes
              </p>
              <textarea
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
                onBlur={saveDetail}
                placeholder="Add notes..."
                rows={3}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <p className="text-xs text-text-secondary mb-2 font-medium">
                Category
              </p>
              <select
                value={detailCategory ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setDetailCategory(val);
                  if (selectedBookmark) {
                    updateBookmark.mutate({
                      id: selectedBookmark.id,
                      data: { category_id: val },
                    });
                  }
                }}
                className="w-full bg-background border border-border rounded-lg h-9 px-3 text-sm text-text-primary outline-none focus:border-accent transition-colors"
              >
                <option value="">None</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Pin Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">Pinned</span>
              <button
                onClick={() => {
                  const newPinned = !detailPinned;
                  setDetailPinned(newPinned);
                  updateBookmark.mutate(
                    {
                      id: selectedBookmark.id,
                      data: { is_pinned: newPinned },
                    },
                    {
                      onSuccess: (updated) => {
                        setSelectedBookmark(updated);
                      },
                    }
                  );
                }}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  detailPinned
                    ? "bg-accent-muted text-accent"
                    : "bg-surface-hover text-text-secondary hover:text-text-primary"
                )}
              >
                <Pin className="w-4 h-4" />
              </button>
            </div>

            {/* Date */}
            <p className="text-xs text-text-secondary">
              Bookmarked {timeAgo(selectedBookmark.bookmarked_at)}
            </p>
          </div>

          {/* Panel Footer */}
          <div className="p-4 border-t border-border space-y-2 shrink-0">
            <a
              href={selectedBookmark.tweet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-9 bg-surface-hover rounded-lg text-sm text-text-primary hover:bg-border-hover transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open on X
            </a>
            <button
              onClick={handleDelete}
              className="flex items-center justify-center gap-2 w-full h-9 rounded-lg text-sm text-error hover:bg-error/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Bookmark
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
