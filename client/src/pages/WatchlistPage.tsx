import { useState } from "react";
import {
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { cn, timeAgo } from "../lib/utils";
import {
  useWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useCheckWatchlist,
} from "../hooks/use-research";
import type { WatchlistCheckResult, Tweet } from "../lib/api";
import TweetCard from "../components/research/TweetCard";

export default function WatchlistPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newNote, setNewNote] = useState("");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    new Set()
  );
  const [checkResults, setCheckResults] = useState<
    Map<string, WatchlistCheckResult>
  >(new Map());

  const { data: watchlist, isLoading } = useWatchlist();
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();
  const checkMutation = useCheckWatchlist();

  const handleAdd = () => {
    if (!newUsername.trim()) return;
    addMutation.mutate(
      {
        username: newUsername.trim().replace(/^@/, ""),
        note: newNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNewUsername("");
          setNewNote("");
          setShowAddForm(false);
        },
      }
    );
  };

  const handleRemove = (username: string) => {
    if (!confirm(`Remove @${username} from watchlist?`)) return;
    removeMutation.mutate(username);
  };

  const handleCheckAll = () => {
    checkMutation.mutate(undefined, {
      onSuccess: (results) => {
        const map = new Map<string, WatchlistCheckResult>();
        results.forEach((r) => map.set(r.username, r));
        setCheckResults(map);
        // Expand all accounts that have results
        const expanded = new Set<string>();
        results.forEach((r) => {
          if (r.tweets.length > 0) expanded.add(r.username);
        });
        setExpandedAccounts(expanded);
      },
    });
  };

  const toggleExpand = (username: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Watchlist</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckAll}
            disabled={checkMutation.isPending || !watchlist?.length}
            className="flex items-center gap-2 bg-accent text-white rounded-lg px-4 h-9 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checkMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Check All
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 border border-border bg-surface text-text-primary rounded-lg px-4 h-9 text-sm font-medium hover:bg-surface-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="@username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="flex-1 bg-background border border-border rounded-lg h-10 px-4 text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="flex-1 bg-background border border-border rounded-lg h-10 px-4 text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending || !newUsername.trim()}
              className="bg-accent text-white rounded-lg px-4 h-10 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {addMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Save
            </button>
          </div>
          {addMutation.isError && (
            <p className="text-error text-sm">
              {(addMutation.error as Error).message || "Failed to add account"}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {checkMutation.isError && (
        <p className="text-error text-sm">
          {(checkMutation.error as Error).message ||
            "Failed to check watchlist"}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface rounded-xl p-4 border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="h-5 w-28 bg-surface-hover rounded animate-pulse" />
                <div className="h-4 w-40 bg-surface-hover rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Watchlist */}
      {watchlist && watchlist.length > 0 ? (
        <div className="space-y-3">
          {watchlist.map((entry) => {
            const isExpanded = expandedAccounts.has(entry.username);
            const result = checkResults.get(entry.username);
            const hasResults = result && result.tweets.length > 0;

            return (
              <div
                key={entry.id}
                className="bg-surface rounded-xl border border-border overflow-hidden"
              >
                {/* Account Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-medium">
                        @{entry.username}
                      </span>
                      {hasResults && (
                        <span className="text-xs bg-accent-muted text-accent px-2 py-0.5 rounded-full">
                          {result.tweets.length} new
                        </span>
                      )}
                      {result?.error && (
                        <span className="text-xs text-error">
                          {result.error}
                        </span>
                      )}
                    </div>
                    {entry.note && (
                      <p className="text-text-secondary text-sm mt-0.5 truncate">
                        {entry.note}
                      </p>
                    )}
                    <p className="text-text-tertiary text-xs mt-1">
                      Added {timeAgo(entry.added_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(hasResults || isExpanded) && (
                      <button
                        onClick={() => toggleExpand(entry.username)}
                        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(entry.username)}
                      disabled={removeMutation.isPending}
                      className="p-2 rounded-lg text-text-secondary hover:text-error hover:bg-error/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Tweets */}
                {isExpanded && hasResults && (
                  <div className="border-t border-border p-4 space-y-3">
                    {result.tweets.map((tweet) => (
                      <TweetCard key={tweet.id} tweet={tweet} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !isLoading && (
          <div className="bg-surface rounded-xl border border-border p-12 text-center">
            <p className="text-text-secondary text-sm">
              No accounts in your watchlist. Add accounts to monitor their
              tweets.
            </p>
          </div>
        )
      )}
    </div>
  );
}
