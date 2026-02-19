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
  tags?: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
  bookmark_count?: number;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
  bookmark_count?: number;
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
  rule_type: "keyword" | "hashtag" | "author" | "url_domain";
  pattern: string;
  created_at: string;
  tag_name?: string;
  tag_color?: string;
}

export interface SyncResult {
  newCount: number;
  updatedCount: number;
  totalSynced: number;
}

export interface AuthStatus {
  authenticated: boolean;
  username?: string;
  user_id?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
