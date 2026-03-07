# Claude Lens

The control tower for Claude Code's multi-agent system. A native desktop app that turns your `~/.claude/` directory into a real-time observability dashboard — teams, costs, conversations, analytics, and system health in one window.

![Claude Lens](screenshots/card-view-dark.png)

## The Problem

Claude Code's agent teams are powerful, but once a swarm is running you're left with:

- Terminal output scrolling past faster than you can read
- Manually `cat`-ing JSON task files to check status
- No cost visibility until the API bill arrives
- No way to browse past conversations without parsing `.jsonl` files

Claude Lens fixes all of that.

## Features

### Team Monitoring

Three layouts for watching your agent swarm in real time:

**Card View** — A responsive grid with progress bars, agent counts, model badges, task lists, and live cost per team.

![Card View](screenshots/card-view.png)

**Graph View** — Interactive node graph of your team topology powered by React Flow. Violet edges for team-agent links, animated pulses for in-progress tasks, dashed orange for blocking dependencies.

![Graph View](screenshots/graph-view.png)

**Split View** — Graph on the left, detail panel on the right.

![Split View](screenshots/split-view.png)

- Create teams from the UI — no terminal required
- Per-team actions: delete, archive, clear tasks, reveal in Finder/Files, copy name
- Real-time filesystem watcher pushes updates without manual refresh

### Projects

Every Claude Code project on your machine as a card — session count, total spend, models used, linked teams. Sort by recency, cost, or tokens.

![Projects](screenshots/projects-view.png)

### Analytics

Five tabs of usage insight, lazy-loaded and auto-refreshing every 30s (paused when the window is hidden):

**Overview** — Stacked bar chart of daily tokens and cost (7d / 30d / 90d). Top Projects by Cost ranking.

![Analytics Overview](screenshots/analytics-overview.png)

**Heatmap** — GitHub-style 365-day activity calendar.

![Heatmap](screenshots/activity-heatmap.png)

**Models** — Per-model breakdown of messages, tokens, cache utilization, and cost.

![Models](screenshots/analytics-models.png)

**Cache** — Hit rate, total savings in USD, and daily cache read vs. write chart.

![Cache](screenshots/analytics-cache.png)

**Activity Feed** — Reverse-chronological log of all assistant turns with timestamps, projects, and message previews.

![Activity Feed](screenshots/analytics-activity-feed.png)

### Conversation Browser

Collapsible project tree with full conversation rendering — user/assistant bubbles, expandable tool-use blocks, inline token counts, and per-session cost in the sidebar.

![Conversations](screenshots/conversation-browser.png)

- **Ctrl+F** search with match highlighting across the entire thread
- **Export as Markdown** — one-click `.md` download of any session

### Full-Text Search

Debounced search across every JSONL session file on disk. Highlighted snippets, click-to-jump.

![Search](screenshots/search-view.png)

### Content

Browse Claude Code's internal state — memory files, active plans, todo lists, and project disk usage with one-click cleanup.

![Content](screenshots/content-view.png)

### Settings GUI

A full interface over `~/.claude/settings.json` — no text editor required.

**General** — Effort level, permission mode, environment variables, status line command.

![Settings](screenshots/settings-general.png)

**Hooks** — Manage Pre/Post tool-use hooks with an inline test runner. Click play, see stdout/stderr and exit codes live.

![Hooks](screenshots/settings-hooks.png)

**MCP Servers** — Add and configure servers with a clean form.

![MCP](screenshots/settings-mcp.png)

**Notifications & Budget** — Desktop notifications for task completions and team creation. Budget limits with soft warnings and hard alerts.

![Notifications](screenshots/settings-notifications.png)

**Profiles & Templates** — Snapshot settings or save team topologies as reusable templates.

### System

Live process table of all `claude` sessions with CPU%, memory%, elapsed time, and **CPU sparklines** (rolling 60s history). One-click kill for hung sessions.

![System](screenshots/system-view.png)

Auth monitoring with token expiry badges. Telemetry event browser.

![Auth](screenshots/system-auth.png)

### Command Palette & Keyboard Shortcuts

`Ctrl+K` / `Cmd+K` opens fuzzy-matched navigation to any view, team, or project.

![Command Palette](screenshots/command-palette.png)

| Shortcut | Action |
|---|---|
| `1` – `8` | Jump to view |
| `r` | Refresh data |
| `Ctrl+K` / `Cmd+K` | Command palette |
| `Ctrl+F` | Search current conversation |
| `Escape` | Close palette / modal |

## How It Works

Claude Lens is a **read-mostly companion**. It never modifies your conversation history or interferes with running agents.

A Node.js main process watches the filesystem with `chokidar`, handles JSONL scanning and deduplication, and pushes updates via IPC to the React frontend. Write operations (team creation, settings changes, process kills) are only triggered by explicit user action.

### Data Sources

| Path | What it reads |
|---|---|
| `~/.claude/teams/*/config.json` | Team metadata and member list |
| `~/.claude/tasks/*/` | Task JSON files per team |
| `~/.claude/projects/*/` | Session JSONL files (conversations + usage) |
| `~/.claude/settings.json` | Claude Code settings |
| `~/.claude/settings.local.json` | Local settings overrides |

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 40 |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Build | Vite 7, electron-builder |
| Charts | Recharts 3 |
| Graph | @xyflow/react (React Flow) v12 |
| File Watching | chokidar 5 |
| Icons | lucide-react |

## Quick Start

```bash
gh repo clone shansin/claude-lens
cd claude-lens
npm install
npm run dev
```

If you've used Claude Code before, the dashboard is live immediately with your data.

### Production Build

```bash
npm run build
```

Output goes to `release/`.

| Platform | Format |
|---|---|
| macOS | `.dmg` |
| Windows | NSIS installer |
| Linux | `AppImage` |

### Screenshots & Recording

```bash
npm run screenshots    # Captures PNGs of each view into screenshots/
npm run record         # Records an MP4 session (requires ffmpeg)
```

## Project Structure

```
claude-lens/
├── electron/
│   ├── main.ts            # Main process, IPC handlers, file watcher, cost scanner
│   ├── preload.ts         # Context bridge (renderer ↔ main)
│   └── modules/           # analytics, content, metrics, notifications, settings, system, viewer
├── src/
│   ├── App.tsx            # Root layout, view routing, command palette, CreateTeam modal
│   ├── components/views/  # Top-level views
│   ├── components/*.tsx   # Shared components
│   ├── hooks/useTeamData.ts # Main data hook
│   └── types.ts           # Shared TypeScript types
├── scripts/               # Screenshot & recording automation
└── package.json
```

## Prerequisites

- Node.js 18+
- npm 9+

## License

ISC
