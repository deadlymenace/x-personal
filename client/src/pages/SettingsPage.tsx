import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, Plus, Play, Upload } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth, useSystemStatus } from "../hooks/use-auth";
import { useTags } from "../hooks/use-tags";
import {
  getLoginUrl,
  getAutoTagRules,
  createAutoTagRule,
  deleteAutoTagRule,
  applyAllRules,
  clearCache,
} from "../lib/api";
import type { AutoTagRule } from "../lib/api";
import { useImportBookmarks } from "../hooks/use-bookmarks";
import TagBadge from "../components/tags/TagBadge";

export default function SettingsPage() {
  return (
    <div className="space-y-0">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">
        Settings
      </h1>

      <ConnectionSection />
      <AutoTagSection />
      <ImportSection />
      <CacheSection />
      <DbStatsSection />
    </div>
  );
}

function ConnectionSection() {
  const { data: auth, isLoading: authLoading } = useAuth();
  const { data: status, isLoading: statusLoading } = useSystemStatus();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await getLoginUrl();
      window.location.href = url;
    } catch (err) {
      setConnecting(false);
      alert((err as Error).message || "Failed to get login URL");
    }
  };

  const isLoading = authLoading || statusLoading;

  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Connection Status
      </h2>

      {isLoading ? (
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="h-5 w-48 bg-surface-hover rounded animate-pulse" />
        </div>
      ) : (
        <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
          {/* Auth Status */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-3 h-3 rounded-full shrink-0",
                auth?.authenticated ? "bg-success" : "bg-error"
              )}
            />
            <span className="text-text-primary text-sm">
              {auth?.authenticated
                ? `Connected as @${auth.username}`
                : "Not connected"}
            </span>
          </div>

          {/* Bearer Token */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-3 h-3 rounded-full shrink-0",
                status?.hasBearerToken ? "bg-success" : "bg-error"
              )}
            />
            <span className="text-text-secondary text-sm">
              Bearer Token:{" "}
              {status?.hasBearerToken ? "Configured" : "Not configured"}
            </span>
          </div>

          {/* OAuth Status */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-3 h-3 rounded-full shrink-0",
                status?.hasClientId ? "bg-success" : "bg-warning"
              )}
            />
            <span className="text-text-secondary text-sm">
              OAuth Client:{" "}
              {status?.hasClientId ? "Configured" : "Not configured"}
            </span>
          </div>

          {/* Connect Button */}
          {!auth?.authenticated && (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex items-center gap-2 bg-accent text-white rounded-lg px-4 h-9 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
              Connect X Account
            </button>
          )}
        </div>
      )}

      <div className="border-t border-border mt-6 pt-6" />
    </section>
  );
}

function AutoTagSection() {
  const { data: tags } = useTags();
  const [rules, setRules] = useState<AutoTagRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  // New rule form
  const [newTagId, setNewTagId] = useState("");
  const [newType, setNewType] = useState("keyword");
  const [newPattern, setNewPattern] = useState("");
  const [addingRule, setAddingRule] = useState(false);

  const loadRules = async () => {
    setRulesLoading(true);
    try {
      const data = await getAutoTagRules();
      setRules(data);
    } catch (err) {
      // silently fail
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleAddRule = async () => {
    if (!newTagId || !newPattern.trim()) return;
    setAddingRule(true);
    try {
      const rule = await createAutoTagRule({
        tag_id: Number(newTagId),
        rule_type: newType,
        pattern: newPattern.trim(),
      });
      setRules((prev) => [...prev, rule]);
      setNewTagId("");
      setNewPattern("");
    } catch (err) {
      alert((err as Error).message || "Failed to add rule");
    } finally {
      setAddingRule(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await deleteAutoTagRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert((err as Error).message || "Failed to delete rule");
    }
  };

  const handleApplyAll = async () => {
    setApplying(true);
    setApplyResult(null);
    try {
      const result = await applyAllRules();
      setApplyResult(`Applied rules to ${result.applied} bookmark(s)`);
    } catch (err) {
      setApplyResult((err as Error).message || "Failed to apply rules");
    } finally {
      setApplying(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">
          Auto-Tag Rules
        </h2>
        <button
          onClick={handleApplyAll}
          disabled={applying || rules.length === 0}
          className="flex items-center gap-2 bg-accent text-white rounded-lg px-3 h-8 text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {applying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Apply All Rules
        </button>
      </div>

      {applyResult && (
        <p className="text-sm text-text-secondary mb-3">{applyResult}</p>
      )}

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {/* Rules List */}
        {rulesLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-5 w-16 bg-surface-hover rounded animate-pulse" />
                <div className="h-5 w-20 bg-surface-hover rounded animate-pulse" />
                <div className="h-5 w-32 bg-surface-hover rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : rules.length > 0 ? (
          <div className="divide-y divide-border">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <TagBadge
                  name={rule.tag_name || `Tag #${rule.tag_id}`}
                  color={rule.tag_color || "#1d9bf0"}
                />
                <span className="text-xs font-mono bg-surface-hover text-text-secondary px-2 py-0.5 rounded">
                  {rule.rule_type}
                </span>
                <span className="text-sm text-text-primary flex-1 truncate">
                  {rule.pattern}
                </span>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="p-1.5 rounded-md text-text-secondary hover:text-error hover:bg-error/10 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-text-secondary text-sm">
              No auto-tag rules yet.
            </p>
          </div>
        )}

        {/* Add Rule Form */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2">
            <select
              value={newTagId}
              onChange={(e) => setNewTagId(e.target.value)}
              className="bg-background border border-border rounded-lg h-9 px-2 text-text-primary text-sm outline-none focus:border-accent transition-colors"
            >
              <option value="">Select tag...</option>
              {tags?.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>

            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-background border border-border rounded-lg h-9 px-2 text-text-primary text-sm outline-none focus:border-accent transition-colors"
            >
              <option value="keyword">keyword</option>
              <option value="hashtag">hashtag</option>
              <option value="author">author</option>
              <option value="url_domain">url_domain</option>
            </select>

            <input
              type="text"
              placeholder="Pattern..."
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddRule();
              }}
              className="flex-1 bg-background border border-border rounded-lg h-9 px-3 text-text-primary text-sm placeholder-text-secondary outline-none focus:border-accent transition-colors"
            />

            <button
              onClick={handleAddRule}
              disabled={addingRule || !newTagId || !newPattern.trim()}
              className="flex items-center gap-1.5 bg-accent text-white rounded-lg px-3 h-9 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {addingRule ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Add Rule
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-border mt-6 pt-6" />
    </section>
  );
}

function ImportSection() {
  const importMutation = useImportBookmarks();
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const bookmarks = data.bookmarks || data;
      if (!Array.isArray(bookmarks)) {
        setResult("Invalid file format: expected an array of bookmarks");
        return;
      }
      importMutation.mutate(bookmarks, {
        onSuccess: (res) => {
          setResult(`Imported ${res.imported} bookmarks (${res.skipped} skipped)`);
        },
        onError: (err) => {
          setResult(err.message || "Import failed");
        },
      });
    } catch {
      setResult("Failed to parse JSON file");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Import Bookmarks
      </h2>
      <div className="bg-surface rounded-xl p-4 border border-border space-y-3">
        <p className="text-sm text-text-secondary">
          Import bookmarks from a JSON file (exported from this app or compatible format).
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
            className="flex items-center gap-2 bg-surface-hover text-text-primary rounded-lg px-4 h-9 text-sm font-medium hover:bg-border-hover transition-colors border border-border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {importMutation.isPending ? "Importing..." : "Choose JSON File"}
          </button>
          {result && (
            <span className="text-sm text-text-secondary">{result}</span>
          )}
        </div>
      </div>
      <div className="border-t border-border mt-6 pt-6" />
    </section>
  );
}

function CacheSection() {
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleClear = async () => {
    setClearing(true);
    setResult(null);
    try {
      const res = await clearCache();
      setResult(`Cache cleared (${res.removed} entries removed)`);
    } catch (err) {
      setResult((err as Error).message || "Failed to clear cache");
    } finally {
      setClearing(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary mb-4">Cache</h2>

      <div className="bg-surface rounded-xl p-4 border border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClear}
            disabled={clearing}
            className="flex items-center gap-2 bg-surface-hover text-text-primary rounded-lg px-4 h-9 text-sm font-medium hover:bg-border-hover transition-colors border border-border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing && <Loader2 className="w-4 h-4 animate-spin" />}
            Clear Cache
          </button>
          {result && (
            <span className="text-sm text-text-secondary">{result}</span>
          )}
        </div>
      </div>

      <div className="border-t border-border mt-6 pt-6" />
    </section>
  );
}

function DbStatsSection() {
  const { data: status, isLoading } = useSystemStatus();

  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Database Stats
      </h2>

      {isLoading ? (
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 w-40 bg-surface-hover rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-secondary">Bookmarks</span>
            <span className="text-sm text-text-primary font-medium">
              {status?.bookmarkCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-secondary">Tags</span>
            <span className="text-sm text-text-primary font-medium">
              {status?.tagCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-secondary">Categories</span>
            <span className="text-sm text-text-primary font-medium">
              {status?.categoryCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-secondary">Total Synced</span>
            <span className="text-sm text-text-primary font-medium">
              {status?.totalSynced ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-secondary">Last Sync</span>
            <span className="text-sm text-text-primary font-medium">
              {status?.lastSync ? new Date(status.lastSync).toLocaleString() : "Never"}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
