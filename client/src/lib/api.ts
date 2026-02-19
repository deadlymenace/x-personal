const BASE = "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

// Auth
export const getAuthStatus = () => request<AuthStatus>("/auth/status");
export const getLoginUrl = () => request<{ url: string }>("/auth/login");
export const handleAuthCallback = (code: string, state: string) =>
  request<{ success: boolean; username: string }>(
    `/auth/callback?code=${code}&state=${state}`
  );
export const logout = () => request("/auth/logout", { method: "POST" });

// Bookmarks
export const getBookmarks = (params: Record<string, string>) => {
  const qs = new URLSearchParams(params).toString();
  return request<PaginatedResponse<Bookmark>>(`/bookmarks?${qs}`);
};
export const getBookmark = (id: string) =>
  request<Bookmark>(`/bookmarks/${id}`);
export const updateBookmark = (id: string, data: Partial<Bookmark>) =>
  request<Bookmark>(`/bookmarks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const deleteBookmark = (id: string) =>
  request(`/bookmarks/${id}`, { method: "DELETE" });
export const syncBookmarks = () =>
  request<SyncResult>("/bookmarks/sync", { method: "POST" });
export const getBookmarkStats = () =>
  request<BookmarkStats>("/bookmarks/meta/stats");

// Export bookmarks (downloads file)
export const exportBookmarks = async (format: "json" | "csv") => {
  const res = await fetch(`/api/bookmarks/export?format=${format}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Export failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bookmarks.${format}`;
  a.click();
  URL.revokeObjectURL(url);
};

// Import bookmarks
export const importBookmarks = (bookmarks: any[]) =>
  request<{ success: boolean; imported: number; skipped: number; total: number }>(
    "/bookmarks/import",
    { method: "POST", body: JSON.stringify({ bookmarks }) }
  );

// Bulk operations
export const bulkDeleteBookmarks = (ids: string[]) =>
  request<{ success: boolean; deleted: number }>("/bookmarks/bulk/delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

export const bulkTagBookmarks = (ids: string[], tagIds: number[]) =>
  request<{ success: boolean; added: number }>("/bookmarks/bulk/tag", {
    method: "POST",
    body: JSON.stringify({ ids, tagIds }),
  });

export const bulkUntagBookmarks = (ids: string[], tagIds: number[]) =>
  request<{ success: boolean; removed: number }>("/bookmarks/bulk/untag", {
    method: "POST",
    body: JSON.stringify({ ids, tagIds }),
  });

// Tags
export const getTags = () => request<Tag[]>("/tags");
export const createTag = (data: { name: string; color: string }) =>
  request<Tag>("/tags", { method: "POST", body: JSON.stringify(data) });
export const updateTag = (id: number, data: Partial<Tag>) =>
  request<Tag>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteTag = (id: number) =>
  request(`/tags/${id}`, { method: "DELETE" });
export const addTagsToBookmark = (bookmarkId: string, tagIds: number[]) =>
  request<Tag[]>(`/tags/bookmark/${bookmarkId}`, {
    method: "POST",
    body: JSON.stringify({ tagIds }),
  });
export const removeTagFromBookmark = (bookmarkId: string, tagId: number) =>
  request(`/tags/bookmark/${bookmarkId}/${tagId}`, { method: "DELETE" });
export const getAutoTagRules = () => request<AutoTagRule[]>("/tags/rules");
export const createAutoTagRule = (data: {
  tag_id: number;
  rule_type: string;
  pattern: string;
}) =>
  request<AutoTagRule>("/tags/rules", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const deleteAutoTagRule = (id: number) =>
  request(`/tags/rules/${id}`, { method: "DELETE" });
export const applyAllRules = () =>
  request<{ applied: number }>("/tags/rules/apply", { method: "POST" });

// Categories
export const getCategories = () => request<Category[]>("/categories");
export const createCategory = (data: { name: string; icon?: string }) =>
  request<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const deleteCategory = (id: number) =>
  request(`/categories/${id}`, { method: "DELETE" });

// AI Categorization
export const suggestCategories = () =>
  request<CategorySuggestion[]>("/categories/suggest", { method: "POST" });
export const acceptCategorySuggestion = (data: { name: string; icon: string }) =>
  request<{ category: Category; categorized: number }>(
    "/categories/accept-suggestion",
    { method: "POST", body: JSON.stringify(data) }
  );
export const autoCategorize = (
  categoryId: number,
  onProgress: (progress: {
    current: number;
    total: number;
    message: string;
    done?: boolean;
    categorized?: number;
    error?: string;
  }) => void
) => {
  return fetch(`${BASE}/categories/${categoryId}/auto-categorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          onProgress(data);
        }
      }
    }
  });
};

// Research
export const researchSearch = (data: {
  query: string;
  sort?: string;
  pages?: number;
  since?: string;
  minLikes?: number;
  minImpressions?: number;
  limit?: number;
}) =>
  request<ResearchResult>("/research/search", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const researchThread = (tweetId: string) =>
  request<{ data: Tweet[]; total: number }>(`/research/thread/${tweetId}`);
export const researchProfile = (opts: {
  username: string;
  includeReplies?: boolean;
}) => {
  const qs = opts.includeReplies ? "?replies=true" : "";
  return request<{ user: any; tweets: Tweet[] }>(
    `/research/profile/${opts.username}${qs}`
  );
};
export const researchTweet = (tweetId: string) =>
  request<Tweet>(`/research/tweet/${tweetId}`);
export const bookmarkFromResearch = (tweetId: string) =>
  request(`/research/bookmark/${tweetId}`, { method: "POST" });

// Deep research (SSE streaming)
export interface DeepSearchEvent {
  type:
    | "status"
    | "tweets"
    | "analysis_chunk"
    | "done"
    | "error";
  message?: string;
  content?: string;
  data?: Tweet[];
  total?: number;
  cached?: boolean;
}

function readSSE(
  url: string,
  body: any,
  onEvent: (event: DeepSearchEvent) => void
): Promise<void> {
  return fetch(`${BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Request failed");
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            onEvent(JSON.parse(line.slice(6)));
          } catch {}
        }
      }
    }
  });
}

export const deepSearch = (
  data: {
    query: string;
    sort?: string;
    pages?: number;
    since?: string;
    minLikes?: number;
    minImpressions?: number;
    limit?: number;
  },
  onEvent: (event: DeepSearchEvent) => void
) => readSSE("/research/deep-search", data, onEvent);

export const analyzeResearch = (
  data: { tweets: Tweet[]; question: string },
  onEvent: (event: DeepSearchEvent) => void
) => readSSE("/research/analyze", data, onEvent);

// Watchlist
export const getWatchlist = () => request<WatchlistEntry[]>("/research/watchlist");
export const addToWatchlist = (data: { username: string; note?: string }) =>
  request<WatchlistEntry>("/research/watchlist", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const removeFromWatchlist = (username: string) =>
  request(`/research/watchlist/${username}`, { method: "DELETE" });
export const checkWatchlist = () =>
  request<WatchlistCheckResult[]>("/research/watchlist/check", {
    method: "POST",
  });

// Settings
export const getSystemStatus = () => request<SystemStatus>("/settings/status");
export const clearCache = () =>
  request<{ removed: number }>("/settings/cache/clear", { method: "POST" });

// Types
export interface AuthStatus {
  authenticated: boolean;
  username?: string;
  user_id?: string;
}

export interface Bookmark {
  id: string;
  text: string;
  author_id: string;
  author_username: string;
  author_name: string;
  tweet_url: string;
  created_at: string;
  conversation_id: string | null;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions: number;
  bookmark_count: number;
  urls: string[];
  mentions: string[];
  hashtags: string[];
  category_id: number | null;
  notes: string;
  is_pinned: boolean;
  bookmarked_at: string;
  synced_at: string;
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  bookmark_count?: number;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  sort_order: number;
  bookmark_count?: number;
}

export interface Tweet {
  id: string;
  text: string;
  author_id: string;
  username: string;
  name: string;
  created_at: string;
  conversation_id: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    impressions: number;
    bookmarks: number;
  };
  urls: string[];
  mentions: string[];
  hashtags: string[];
  tweet_url: string;
}

export interface WatchlistEntry {
  id: number;
  username: string;
  note: string;
  added_at: string;
}

export interface AutoTagRule {
  id: number;
  tag_id: number;
  rule_type: string;
  pattern: string;
  tag_name?: string;
  tag_color?: string;
}

export interface SyncResult {
  newCount: number;
  updatedCount: number;
  totalSynced: number;
}

export interface BookmarkStats {
  total: number;
  tagCount: number;
  categoryCount: number;
  lastSync: string | null;
  totalSynced: number;
  topTags: { name: string; color: string; count: number }[];
  topAuthors: { author_username: string; count: number }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ResearchResult {
  data: Tweet[];
  total: number;
  cached: boolean;
  cost: string;
}

export interface WatchlistCheckResult {
  username: string;
  note: string;
  user?: any;
  tweets: Tweet[];
  error?: string;
}

export interface CategorySuggestion {
  name: string;
  icon: string;
  reason: string;
  estimatedCount: number;
  sampleBookmarkIds: string[];
}

export interface SystemStatus {
  authenticated: boolean;
  user: { user_id: string; username: string } | null;
  hasBearerToken: boolean;
  hasClientId: boolean;
  bookmarkCount: number;
  tagCount: number;
  categoryCount: number;
  lastSync: string | null;
  totalSynced: number;
}
