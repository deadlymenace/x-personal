import {
  Heart,
  Repeat2,
  Eye,
  Loader2,
  BookmarkPlus,
  MessageSquare,
} from "lucide-react";
import type { Tweet } from "../../lib/api";
import { cn, compactNumber, timeAgo } from "../../lib/utils";
import { useBookmarkFromResearch } from "../../hooks/use-research";

interface TweetCardProps {
  tweet: Tweet;
  onTagClick?: (tag: string) => void;
  onViewThread?: (conversationId: string) => void;
}

/** Remove t.co links from tweet text for cleaner display. */
function cleanText(text: string): string {
  return text.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
}

export default function TweetCard({
  tweet,
  onTagClick,
  onViewThread,
}: TweetCardProps) {
  const bookmarkMutation = useBookmarkFromResearch();

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    bookmarkMutation.mutate(tweet.id);
  };

  return (
    <div
      className={cn(
        "rounded-xl p-4 transition-colors",
        "bg-surface border border-border",
        "hover:border-border-hover"
      )}
    >
      {/* Row 1: Author + time + bookmark button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            @{tweet.username}
          </span>
          <span className="text-xs text-text-secondary">
            {timeAgo(tweet.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {tweet.conversation_id && onViewThread && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewThread(tweet.conversation_id);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1 transition-colors border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Thread
            </button>
          )}
          <button
            onClick={handleBookmark}
            disabled={bookmarkMutation.isPending || bookmarkMutation.isSuccess}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1 transition-colors",
              "border border-accent text-accent",
              "hover:bg-accent-muted",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              bookmarkMutation.isSuccess && "border-success text-success"
            )}
          >
            {bookmarkMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            {bookmarkMutation.isSuccess ? "Saved" : "+Bookmark"}
          </button>
        </div>
      </div>

      {/* Row 2: Tweet text */}
      <p className="text-sm text-text-primary line-clamp-3 mb-3 leading-relaxed">
        {cleanText(tweet.text)}
      </p>

      {/* Row 3: Hashtags as clickable pills */}
      {tweet.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tweet.hashtags.map((ht) => (
            <span
              key={ht}
              onClick={() => onTagClick?.(ht)}
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer",
                "bg-accent-muted text-accent"
              )}
            >
              #{ht}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: Metrics */}
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" />
          {compactNumber(tweet.metrics.likes)}
        </span>
        <span className="flex items-center gap-1">
          <Repeat2 className="h-3.5 w-3.5" />
          {compactNumber(tweet.metrics.retweets)}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          {compactNumber(tweet.metrics.impressions)}
        </span>
      </div>
    </div>
  );
}
