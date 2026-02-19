import { NavLink } from "react-router-dom";
import {
  Bookmark,
  LayoutDashboard,
  Search,
  Eye,
  Settings,
  RefreshCw,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../hooks/use-auth";
import { useSyncBookmarks } from "../../hooks/use-bookmarks";
import { useTheme } from "../../hooks/use-theme";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/research", label: "Research", icon: Search },
  { to: "/watchlist", label: "Watchlist", icon: Eye },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { data: auth } = useAuth();
  const sync = useSyncBookmarks();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[260px] bg-background flex flex-col"
      style={{ borderRight: "1px solid var(--color-border)" }}
    >
      {/* Logo / Title */}
      <div className="flex items-center gap-2.5 px-5 py-6">
        <Bookmark className="h-5 w-5 text-accent" />
        <span className="text-lg font-semibold text-text-primary">
          X Bookmarks
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 h-10 rounded-lg px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-muted text-accent"
                  : "text-text-primary hover:bg-surface-hover"
              )
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="px-3 pb-5 space-y-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-medium transition-colors text-text-primary hover:bg-surface-hover"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>

        {/* Sync Button */}
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className={cn(
            "flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-medium transition-colors",
            "border border-border text-text-primary",
            "hover:border-border-hover hover:bg-surface-hover",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {sync.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {sync.isPending ? "Syncing..." : "Sync Bookmarks"}
        </button>

        {/* Auth Status */}
        <div className="px-2 text-xs text-text-secondary truncate text-center">
          {auth?.authenticated ? (
            <span>
              @{auth.username}
            </span>
          ) : (
            "Not connected"
          )}
        </div>
      </div>
    </aside>
  );
}
