# X Bookmark Manager

A self-hosted personal bookmark manager for X/Twitter with full-text search, auto-tagging, research tools, and a watchlist feature.

## Features

- **Bookmark Sync** — OAuth 2.0 PKCE flow to sync bookmarks from your X account
- **Full-Text Search** — SQLite FTS5-powered search across tweet text, authors, and notes
- **Tagging** — Manual and auto-tagging with rules (keyword, hashtag, author, URL domain)
- **Categories** — Organize bookmarks into custom categories
- **Research** — Search the X API directly, view threads, profiles, and save interesting tweets
- **Watchlist** — Monitor accounts for new content
- **Export/Import** — Export bookmarks as JSON or CSV; import from JSON
- **Bulk Operations** — Select multiple bookmarks to tag or delete at once
- **Dark/Light Theme** — Toggle between dark and light themes with localStorage persistence

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, TanStack Query, React Router, Lucide icons
- **Backend:** Express, TypeScript (tsx), better-sqlite3 (WAL mode)
- **Monorepo:** npm workspaces (client + server)

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- X Developer App credentials ([developer.x.com](https://developer.x.com))

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your credentials:
   - `X_BEARER_TOKEN` — Required for research features (App-only bearer token)
   - `X_CLIENT_ID` — Required for bookmark sync (OAuth 2.0 Client ID)

3. Start development:

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

4. Connect your X account via the Settings page, then click **Sync Bookmarks** in the sidebar.

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker compose up -d
```

The app will be available at http://localhost:3001.

## API Reference

All endpoints are prefixed with `/api`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | /auth/status | Check authentication status |
| GET | /auth/login | Get OAuth login URL |
| GET | /auth/callback | Handle OAuth callback |
| POST | /auth/logout | Log out |

### Bookmarks

| Method | Path | Description |
|--------|------|-------------|
| GET | /bookmarks | List bookmarks (paginated, filterable, searchable) |
| GET | /bookmarks/export?format=json\|csv | Export all bookmarks |
| POST | /bookmarks/import | Import bookmarks from JSON |
| POST | /bookmarks/bulk/delete | Bulk delete bookmarks |
| POST | /bookmarks/bulk/tag | Bulk add tags to bookmarks |
| POST | /bookmarks/bulk/untag | Bulk remove tags from bookmarks |
| GET | /bookmarks/:id | Get single bookmark |
| PATCH | /bookmarks/:id | Update bookmark (notes, category, pin) |
| DELETE | /bookmarks/:id | Delete bookmark |
| POST | /bookmarks/sync | Sync from X API |
| GET | /bookmarks/meta/stats | Dashboard statistics |

### Tags

| Method | Path | Description |
|--------|------|-------------|
| GET | /tags | List all tags with bookmark counts |
| POST | /tags | Create tag |
| PATCH | /tags/:id | Update tag |
| DELETE | /tags/:id | Delete tag |
| POST | /tags/bookmark/:id | Add tags to bookmark |
| DELETE | /tags/bookmark/:bookmarkId/:tagId | Remove tag from bookmark |
| GET | /tags/rules | List auto-tag rules |
| POST | /tags/rules | Create auto-tag rule |
| DELETE | /tags/rules/:id | Delete auto-tag rule |
| POST | /tags/rules/apply | Apply all rules to existing bookmarks |

### Categories

| Method | Path | Description |
|--------|------|-------------|
| GET | /categories | List categories |
| POST | /categories | Create category |
| PATCH | /categories/:id | Update category |
| DELETE | /categories/:id | Delete category |

### Research

| Method | Path | Description |
|--------|------|-------------|
| POST | /research/search | Search tweets via X API |
| GET | /research/thread/:id | Get tweet thread |
| GET | /research/profile/:username | Get user profile and tweets |
| GET | /research/tweet/:id | Get single tweet |
| POST | /research/bookmark/:id | Save research tweet as bookmark |

### Watchlist

| Method | Path | Description |
|--------|------|-------------|
| GET | /research/watchlist | List watched accounts |
| POST | /research/watchlist | Add account to watchlist |
| DELETE | /research/watchlist/:username | Remove from watchlist |
| POST | /research/watchlist/check | Check all for new tweets |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | /settings/status | System status and DB stats |
| POST | /settings/cache/clear | Clear research cache |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `X_BEARER_TOKEN` | For research | App-only Bearer Token from X Developer Portal |
| `X_CLIENT_ID` | For sync | OAuth 2.0 Client ID |
| `X_CLIENT_SECRET` | For sync | OAuth 2.0 Client Secret |
| `X_CONSUMER_KEY` | No | API Key (Consumer Key) |
| `X_CONSUMER_SECRET` | No | API Secret (Consumer Secret) |
| `PORT` | No | Server port (default: 3001) |
| `OAUTH_CALLBACK_URL` | No | OAuth redirect URI (default: http://localhost:5173/callback) |

## Project Structure

```
x-personal/
  client/                # React + Vite frontend
    src/
      components/        # Reusable UI components
        bookmarks/       # BookmarkCard
        layout/          # MainLayout, Sidebar
        tags/            # TagBadge
        tweets/          # TweetCard
      hooks/             # TanStack Query hooks
      lib/               # API client, utilities
      pages/             # Route pages
      styles/            # Global CSS with theme variables
  server/                # Express + SQLite backend
    src/
      db/                # Database connection + schema
      lib/               # X API wrapper, cache, formatters
      routes/            # Express route handlers
      services/          # OAuth, bookmark sync, auto-tagger
      types/             # TypeScript interfaces
    data/                # SQLite database + cache (gitignored)
```

## Running Tests

```bash
npm test              # Run all tests (server + client)
npm run test:server   # Server tests only
npm run test:client   # Client tests only
```
