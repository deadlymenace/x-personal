import { Heart, Repeat2, Eye, Pin, Check } from "lucide-react";
import type { Bookmark } from "../../lib/api";
import { cn, compactNumber, timeAgo } from "../../lib/utils";
import TagBadge from "../tags/TagBadge";

interface BookmarkCardProps {
  bookmark: Bookmark;
  onTagClick?: (tag: string) => void;
  onBookmarkClick?: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/** Remove t.co links from tweet text for cleaner display. */
function cleanText(text: string): string {
  return text.replace(/https?:\/\/t\.co\/\S+/g, "").trim();
}

export default function BookmarkCard({
  bookmark,
  onTagClick,
  onBookmarkClick,
  selectable,
  selected,
  onSelect,
}: BookmarkCardProps) {
  return (
    <div
      onClick={() =>
        selectable ? onSelect?.(bookmark.id) : onBookmarkClick?.(bookmark.id)
      }
      className={cn(
        "rounded-xl p-4 transition-colors cursor-pointer relative",
        "bg-surface border border-border",
        "hover:border-border-hover",
        selected && "border-accent bg-accent-muted"
      )}
    >
      {selectable && (
        <div className="absolute top-3 right-3">
          <div
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
              selected
                ? "bg-accent border-accent"
                : "border-text-secondary bg-transparent"
            )}
          >
            {selected && <Check className="w-3 h-3 text-white" />}
          </div>
        </div>
      )}

      {/* Row 1: Author + time + pin */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">
          @{bookmark.author_username}
        </span>
        <div className={cn("flex items-center gap-2", selectable && "mr-7")}>
          {bookmark.is_pinned && (
            <Pin className="h-3.5 w-3.5 text-accent" />
          )}
          <span className="text-xs text-text-secondary">
            {timeAgo(bookmark.created_at)}
          </span>
        </div>
      </div>

      {/* Row 2: Tweet text */}
      <p className="text-sm text-text-primary line-clamp-3 mb-3 leading-relaxed">
        {cleanText(bookmark.text)}
      </p>

      {/* Row 3: Tags */}
      {bookmark.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {bookmark.tags.map((tag) => (
            <TagBadge
              key={tag.id}
              name={tag.name}
              color={tag.color}
              onClick={
                onTagClick
                  ? () => onTagClick(tag.name)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Row 4: Metrics */}
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Heart className="h-3.5 w-3.5" />
          {compactNumber(bookmark.likes)}
        </span>
        <span className="flex items-center gap-1">
          <Repeat2 className="h-3.5 w-3.5" />
          {compactNumber(bookmark.retweets)}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          {compactNumber(bookmark.impressions)}
        </span>
      </div>
    </div>
  );
}
