import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn, compactNumber } from "../lib/utils";
import {
  useResearchSearch,
  useResearchThread,
  useResearchProfile,
} from "../hooks/use-research";
import type { Tweet, ResearchResult } from "../lib/api";
import TweetCard from "../components/research/TweetCard";

type TabId = "search" | "thread" | "profile";

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<TabId>("search");

  const tabs: { id: TabId; label: string }[] = [
    { id: "search", label: "Search" },
    { id: "thread", label: "Thread" },
    { id: "profile", label: "Profile" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">Research</h1>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-accent border-b-2 border-accent"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "search" && <SearchTab />}
      {activeTab === "thread" && <ThreadTab />}
      {activeTab === "profile" && <ProfileTab />}
    </div>
  );
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("likes");
  const [since, setSince] = useState("7d");
  const [minLikes, setMinLikes] = useState("");
  const searchMutation = useResearchSearch();

  const handleSearch = () => {
    if (!query.trim()) return;
    searchMutation.mutate({
      query: query.trim(),
      sort,
      since,
      minLikes: minLikes ? Number(minLikes) : undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const result = searchMutation.data as ResearchResult | undefined;

  return (
    <div className="space-y-4">
      {/* Search Input + Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search tweets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-surface border border-border rounded-lg h-10 pl-10 pr-4 text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searchMutation.isPending || !query.trim()}
          className="bg-accent text-white rounded-lg px-4 h-10 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {searchMutation.isPending && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          Search
        </button>
      </div>

      {/* Options Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-text-secondary">Sort:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-surface border border-border rounded-lg h-8 px-2 text-text-primary text-xs outline-none focus:border-accent transition-colors"
          >
            <option value="likes">Likes</option>
            <option value="impressions">Impressions</option>
            <option value="retweets">Retweets</option>
            <option value="recent">Recent</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-text-secondary">Since:</label>
          <select
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="bg-surface border border-border rounded-lg h-8 px-2 text-text-primary text-xs outline-none focus:border-accent transition-colors"
          >
            <option value="1h">1 hour</option>
            <option value="6h">6 hours</option>
            <option value="12h">12 hours</option>
            <option value="1d">1 day</option>
            <option value="7d">7 days</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-xs text-text-secondary">Min likes:</label>
          <input
            type="number"
            value={minLikes}
            onChange={(e) => setMinLikes(e.target.value)}
            placeholder="0"
            className="bg-surface border border-border rounded-lg h-8 w-20 px-2 text-text-primary text-xs outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Error */}
      {searchMutation.isError && (
        <p className="text-error text-sm">
          {(searchMutation.error as Error).message || "Search failed"}
        </p>
      )}

      {/* Loading */}
      {searchMutation.isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {result.total} result{result.total !== 1 ? "s" : ""}
            </span>
            <span className="text-text-secondary">
              ~${result.cost} estimated cost
            </span>
          </div>
          <div className="space-y-3">
            {result.data.map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} />
            ))}
          </div>
          {result.data.length === 0 && (
            <p className="text-text-secondary text-sm text-center py-8">
              No results found. Try broadening your search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadTab() {
  const [tweetId, setTweetId] = useState("");
  const threadMutation = useResearchThread();

  const handleFetch = () => {
    if (!tweetId.trim()) return;
    threadMutation.mutate(tweetId.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleFetch();
  };

  const result = threadMutation.data as
    | { data: Tweet[]; total: number }
    | undefined;

  return (
    <div className="space-y-4">
      {/* Input + Button */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter Tweet ID or URL..."
          value={tweetId}
          onChange={(e) => setTweetId(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-surface border border-border rounded-lg h-10 px-4 text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={handleFetch}
          disabled={threadMutation.isPending || !tweetId.trim()}
          className="bg-accent text-white rounded-lg px-4 h-10 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {threadMutation.isPending && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          Fetch Thread
        </button>
      </div>

      {/* Error */}
      {threadMutation.isError && (
        <p className="text-error text-sm">
          {(threadMutation.error as Error).message || "Failed to fetch thread"}
        </p>
      )}

      {/* Loading */}
      {threadMutation.isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      )}

      {/* Thread Results */}
      {result && result.data.length > 0 && (
        <div className="border-l-2 border-accent ml-4 pl-4 space-y-3">
          {result.data.map((tweet) => (
            <TweetCard key={tweet.id} tweet={tweet} />
          ))}
        </div>
      )}

      {result && result.data.length === 0 && (
        <p className="text-text-secondary text-sm text-center py-8">
          No thread found for this tweet.
        </p>
      )}
    </div>
  );
}

function ProfileTab() {
  const [username, setUsername] = useState("");
  const profileMutation = useResearchProfile();

  const handleFetch = () => {
    if (!username.trim()) return;
    profileMutation.mutate(username.trim().replace(/^@/, ""));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleFetch();
  };

  const result = profileMutation.data as
    | { user: any; tweets: Tweet[] }
    | undefined;

  return (
    <div className="space-y-4">
      {/* Input + Button */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter @username..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-surface border border-border rounded-lg h-10 px-4 text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={handleFetch}
          disabled={profileMutation.isPending || !username.trim()}
          className="bg-accent text-white rounded-lg px-4 h-10 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {profileMutation.isPending && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          Fetch
        </button>
      </div>

      {/* Error */}
      {profileMutation.isError && (
        <p className="text-error text-sm">
          {(profileMutation.error as Error).message ||
            "Failed to fetch profile"}
        </p>
      )}

      {/* Loading */}
      {profileMutation.isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      )}

      {/* Profile Results */}
      {result && (
        <div className="space-y-4">
          {/* User Card */}
          {result.user && (
            <div className="bg-surface rounded-xl p-4 border border-border space-y-2">
              <div>
                <p className="text-text-primary font-medium text-lg">
                  {result.user.name || result.user.username}
                </p>
                <p className="text-text-secondary text-sm">
                  @{result.user.username}
                </p>
              </div>
              {result.user.description && (
                <p className="text-text-primary text-sm">
                  {result.user.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm">
                {result.user.public_metrics && (
                  <>
                    <span className="text-text-primary">
                      <span className="font-semibold">
                        {compactNumber(
                          result.user.public_metrics.followers_count ?? 0
                        )}
                      </span>{" "}
                      <span className="text-text-secondary">followers</span>
                    </span>
                    <span className="text-text-primary">
                      <span className="font-semibold">
                        {compactNumber(
                          result.user.public_metrics.following_count ?? 0
                        )}
                      </span>{" "}
                      <span className="text-text-secondary">following</span>
                    </span>
                    <span className="text-text-primary">
                      <span className="font-semibold">
                        {compactNumber(
                          result.user.public_metrics.tweet_count ?? 0
                        )}
                      </span>{" "}
                      <span className="text-text-secondary">tweets</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tweets */}
          {result.tweets.length > 0 ? (
            <div className="space-y-3">
              {result.tweets.map((tweet) => (
                <TweetCard key={tweet.id} tweet={tweet} />
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-sm text-center py-8">
              No tweets found for this user.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
