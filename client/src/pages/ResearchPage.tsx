import { useState, useEffect, useRef } from "react";
import { Search, Loader2, Sparkles, Send, ChevronDown, ChevronUp } from "lucide-react";
import { cn, compactNumber } from "../lib/utils";
import {
  useResearchSearch,
  useResearchThread,
  useResearchProfile,
} from "../hooks/use-research";
import { deepSearch, analyzeResearch } from "../lib/api";
import type { Tweet, ResearchResult, DeepSearchEvent } from "../lib/api";
import TweetCard from "../components/research/TweetCard";

type TabId = "search" | "thread" | "profile";

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<TabId>("search");
  const [threadId, setThreadId] = useState("");

  const handleViewThread = (conversationId: string) => {
    setThreadId(conversationId);
    setActiveTab("thread");
  };

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

      {activeTab === "search" && (
        <SearchTab onViewThread={handleViewThread} />
      )}
      {activeTab === "thread" && (
        <ThreadTab initialId={threadId} onViewThread={handleViewThread} />
      )}
      {activeTab === "profile" && (
        <ProfileTab onViewThread={handleViewThread} />
      )}
    </div>
  );
}

function SearchTab({
  onViewThread,
}: {
  onViewThread: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("likes");
  const [since, setSince] = useState("7d");
  const [minLikes, setMinLikes] = useState("");
  const [minImpressions, setMinImpressions] = useState("");
  const [pages, setPages] = useState("2");
  const [deepMode, setDeepMode] = useState(true);

  // Deep search state
  const [isSearching, setIsSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [tweetTotal, setTweetTotal] = useState(0);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showTweets, setShowTweets] = useState(true);

  // Follow-up question state
  const [followUp, setFollowUp] = useState("");
  const [followUpAnalysis, setFollowUpAnalysis] = useState("");
  const [isFollowingUp, setIsFollowingUp] = useState(false);

  // Plain search fallback
  const searchMutation = useResearchSearch();

  const analysisRef = useRef<HTMLDivElement>(null);

  const handleSearch = () => {
    if (!query.trim()) return;

    if (!deepMode) {
      searchMutation.mutate({
        query: query.trim(),
        sort,
        since,
        pages: Number(pages),
        minLikes: minLikes ? Number(minLikes) : undefined,
        minImpressions: minImpressions ? Number(minImpressions) : undefined,
      });
      return;
    }

    // Deep research mode
    setIsSearching(true);
    setStatusMsg("Starting...");
    setTweets([]);
    setTweetTotal(0);
    setAnalysis("");
    setError("");
    setFollowUpAnalysis("");

    deepSearch(
      {
        query: query.trim(),
        sort,
        since,
        pages: Number(pages),
        minLikes: minLikes ? Number(minLikes) : undefined,
        minImpressions: minImpressions ? Number(minImpressions) : undefined,
      },
      (event) => {
        switch (event.type) {
          case "status":
            setStatusMsg(event.message || "");
            break;
          case "tweets":
            setTweets(event.data || []);
            setTweetTotal(event.total || 0);
            break;
          case "analysis_chunk":
            setAnalysis((prev) => prev + (event.content || ""));
            break;
          case "error":
            setError(event.message || "Search failed");
            setIsSearching(false);
            break;
          case "done":
            setIsSearching(false);
            setStatusMsg("");
            break;
        }
      }
    ).catch((err) => {
      setError(err.message);
      setIsSearching(false);
    });
  };

  const handleFollowUp = () => {
    if (!followUp.trim() || tweets.length === 0) return;
    setIsFollowingUp(true);
    setFollowUpAnalysis("");

    analyzeResearch(
      { tweets, question: followUp.trim() },
      (event) => {
        switch (event.type) {
          case "analysis_chunk":
            setFollowUpAnalysis((prev) => prev + (event.content || ""));
            break;
          case "error":
            setError(event.message || "Analysis failed");
            setIsFollowingUp(false);
            break;
          case "done":
            setIsFollowingUp(false);
            setFollowUp("");
            break;
        }
      }
    ).catch((err) => {
      setError(err.message);
      setIsFollowingUp(false);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleFollowUpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleFollowUp();
  };

  const plainResult = searchMutation.data as ResearchResult | undefined;
  const isLoading = deepMode ? isSearching : searchMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Search Input + Mode Toggle + Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder={
              deepMode
                ? 'Ask anything... e.g. "What is X saying about $BANKR today?"'
                : "Search tweets..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-surface border border-border rounded-lg h-10 pl-10 pr-4 text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
          />
        </div>
        <button
          onClick={() => setDeepMode(!deepMode)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 h-10 text-sm font-medium transition-colors border whitespace-nowrap",
            deepMode
              ? "bg-accent text-white border-accent"
              : "bg-surface text-text-secondary border-border hover:text-text-primary"
          )}
          title={deepMode ? "Deep Research mode (AI analysis)" : "Basic search mode"}
        >
          <Sparkles className="w-4 h-4" />
          Deep
        </button>
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="bg-accent text-white rounded-lg px-4 h-10 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {deepMode ? "Research" : "Search"}
        </button>
      </div>

      {/* Collapsible Options Row */}
      <div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {showFilters ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          Filters
        </button>
        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap mt-2">
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
                <option value="replies">Replies</option>
                <option value="quotes">Quotes</option>
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
              <label className="text-xs text-text-secondary">Pages:</label>
              <select
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                className="bg-surface border border-border rounded-lg h-8 px-2 text-text-primary text-xs outline-none focus:border-accent transition-colors"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="5">5</option>
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

            <div className="flex items-center gap-1.5">
              <label className="text-xs text-text-secondary">
                Min impressions:
              </label>
              <input
                type="number"
                value={minImpressions}
                onChange={(e) => setMinImpressions(e.target.value)}
                placeholder="0"
                className="bg-surface border border-border rounded-lg h-8 w-24 px-2 text-text-primary text-xs outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {(error || searchMutation.isError) && (
        <p className="text-error text-sm">
          {error ||
            (searchMutation.error as Error)?.message ||
            "Search failed"}
        </p>
      )}

      {/* Status indicator */}
      {isSearching && statusMsg && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          {statusMsg}
        </div>
      )}

      {/* Deep Research: AI Analysis Panel */}
      {deepMode && analysis && (
        <div
          ref={analysisRef}
          className="bg-surface rounded-xl border border-border p-5 space-y-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-text-primary">
              AI Research Briefing
            </span>
            {isSearching && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
            )}
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-text-primary leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-primary [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:space-y-1 [&_li]:text-text-secondary [&_strong]:text-text-primary [&_p]:text-text-secondary">
            <MarkdownRenderer content={analysis} />
          </div>

          {/* Follow-up question */}
          {!isSearching && tweets.length > 0 && (
            <div className="pt-3 border-t border-border">
              {followUpAnalysis && (
                <div className="mb-3 bg-background rounded-lg p-4">
                  <div className="prose prose-sm prose-invert max-w-none text-text-primary leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-primary [&_h2]:mt-3 [&_h2]:mb-1 [&_ul]:space-y-1 [&_li]:text-text-secondary [&_strong]:text-text-primary [&_p]:text-text-secondary">
                    <MarkdownRenderer content={followUpAnalysis} />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a follow-up question about these results..."
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  onKeyDown={handleFollowUpKeyDown}
                  className="flex-1 bg-background border border-border rounded-lg h-9 px-3 text-sm text-text-primary placeholder-text-secondary outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={handleFollowUp}
                  disabled={isFollowingUp || !followUp.trim()}
                  className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3 h-9 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFollowingUp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Ask
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deep mode: Tweets section */}
      {deepMode && tweets.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowTweets(!showTweets)}
            className="flex items-center justify-between w-full text-sm"
          >
            <span className="text-text-secondary">
              {tweetTotal} tweet{tweetTotal !== 1 ? "s" : ""} found
            </span>
            <span className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors">
              {showTweets ? "Hide" : "Show"} tweets
              {showTweets ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </span>
          </button>
          {showTweets && (
            <div className="space-y-3">
              {tweets.map((tweet) => (
                <TweetCard
                  key={tweet.id}
                  tweet={tweet}
                  onViewThread={onViewThread}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plain search results (non-deep mode) */}
      {!deepMode && !searchMutation.isPending && plainResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {plainResult.total} result
              {plainResult.total !== 1 ? "s" : ""}
            </span>
            <span className="text-text-secondary">
              ~${plainResult.cost} estimated cost
            </span>
          </div>
          <div className="space-y-3">
            {plainResult.data.map((tweet) => (
              <TweetCard
                key={tweet.id}
                tweet={tweet}
                onViewThread={onViewThread}
              />
            ))}
          </div>
          {plainResult.data.length === 0 && (
            <p className="text-text-secondary text-sm text-center py-8">
              No results found. Try broadening your search.
            </p>
          )}
        </div>
      )}

      {/* Plain loading */}
      {!deepMode && searchMutation.isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      )}
    </div>
  );
}

/** Simple markdown-to-JSX renderer for AI analysis output. */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-5 space-y-1">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (text: string): React.ReactNode => {
    // bold
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++}>{renderInline(line.slice(3))}</h2>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      elements.push(<p key={key++}>{renderInline(line)}</p>);
    }
  }
  flushList();

  return <>{elements}</>;
}

function ThreadTab({
  initialId,
  onViewThread,
}: {
  initialId?: string;
  onViewThread: (id: string) => void;
}) {
  const [tweetId, setTweetId] = useState(initialId || "");
  const threadMutation = useResearchThread();

  const handleFetch = () => {
    if (!tweetId.trim()) return;
    threadMutation.mutate(tweetId.trim());
  };

  // Auto-fetch when navigated from a TweetCard
  useEffect(() => {
    if (initialId) {
      setTweetId(initialId);
      threadMutation.mutate(initialId);
    }
  }, [initialId]);

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
            <TweetCard
              key={tweet.id}
              tweet={tweet}
              onViewThread={onViewThread}
            />
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

function ProfileTab({
  onViewThread,
}: {
  onViewThread: (id: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [includeReplies, setIncludeReplies] = useState(false);
  const profileMutation = useResearchProfile();

  const handleFetch = () => {
    if (!username.trim()) return;
    profileMutation.mutate({
      username: username.trim().replace(/^@/, ""),
      includeReplies,
    });
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
        <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={includeReplies}
            onChange={(e) => setIncludeReplies(e.target.checked)}
            className="accent-accent"
          />
          Include replies
        </label>
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
                <TweetCard
                  key={tweet.id}
                  tweet={tweet}
                  onViewThread={onViewThread}
                />
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
