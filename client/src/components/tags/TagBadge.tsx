import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface TagBadgeProps {
  name: string;
  color: string;
  onClick?: () => void;
  onRemove?: () => void;
}

export default function TagBadge({
  name,
  color,
  onClick,
  onRemove,
}: TagBadgeProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        onClick && "cursor-pointer"
      )}
      style={{
        backgroundColor: `${color}26`,
        color: color,
      }}
    >
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="inline-flex items-center justify-center rounded-full p-0.5 transition-colors hover:bg-surface-hover"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
