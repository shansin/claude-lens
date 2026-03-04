# Claude Lens

A desktop GUI for monitoring and managing Claude Code agent teams. Built with Electron, React, and TypeScript, Claude Lens gives you a real-time window into your `~/.claude` directory — teams, tasks, conversations, costs, and system health, all in one place.

![Card View](screenshots/card-view-dark.png)

## Features

### Team & Task Management
- **Card View** — compact grid of all active teams with status badges, task counts, and cost summaries
- **Graph View** — interactive node-graph showing agent relationships and team topology (powered by React Flow)
- **Split View** — side-by-side team list + detail panel for focused task inspection

![Card View](screenshots/card-view.png)
![Graph View](screenshots/graph-view.png)
![Split View](screenshots/split-view.png)
- Per-team actions: delete, archive (moves to `~/.claude/teams-archive/`), clear tasks, reveal in Finder/Files, copy team name
- Real-time filesystem watcher (chokidar) pushes updates to the UI without manual refresh

### Cost Tracking
- Reads and parses all JSONL conversation files from `~/.claude/projects/`
- Deduplicates messages by ID to avoid double-counting
- Calculates exact USD cost per session using current Anthropic pricing for all Claude model families (Opus, Sonnet, Haiku — versions 3 through 4.6)
- Aggregates costs per team, per project, and per session

### Analytics Dashboard
- **Usage Overview** — 30-day stacked bar chart showing daily input, output, and cache token counts, along with daily cost
- **Activity Heatmap** — GitHub-style 365-day contribution calendar of sessions over time
- **Model Comparison** — side-by-side model comparison chart breaking down cost and usage across models
- **Activity Feed** — reverse-chronological log of all assistant turns showing timestamps, projects, and message previews

![Analytics Overview](screenshots/analytics-overview.png)
![Activity Heatmap](screenshots/activity-heatmap.png)
![Model Comparison](screenshots/analytics-models.png)
![Activity Feed](screenshots/analytics-activity-feed.png)

### Projects View
- Scans `~/.claude/projects/` and surfaces all Claude Code projects with session history
- Per-project metrics: session count, total spend, models used, and linked teams
- Quick-open working directory directly from the app

![Projects View](screenshots/projects-view.png)

### Conversation Browser
- Browse and read full conversation histories from any project session with a collapsible project tree
- Renders conversations with distinct styling for user/assistant messages, tool use blocks, and thinking blocks
- Inline token counts for every message

![Conversation Browser](screenshots/conversation-browser.png)

### Full-Text Search
- Debounced full-text search across every JSONL session file on disk
- Results include highlighted match snippets and context
- Click any result to jump directly directly into the Conversation View for that session

![Search View](screenshots/search-view.png)

### Command Palette
- Press `Ctrl+K` / `Cmd+K` to open the command palette for instant, fuzzy-matched navigation to any view, team, or project

![Command Palette](screenshots/command-palette.png)

### Content Management
- **Plans** — View all your markdown plans from `~/.claude/plans/`
- **Todos** — Track per-agent todo lists from `~/.claude/todos/`
- **Memory** — Browse memory files across all projects and your working directory's `CLAUDE.md`
- **Cleanup** — List projects sorted by disk usage, with one-click cleanup of old session files
- **Export** — One-click CSV export of all usage data (date, project, session, team, model, tokens, cost)

![Content View](screenshots/content-view.png)

### System Monitoring
- **Processes** — live table of running Claude-related processes, showing CPU%, memory%, and elapsed time. Includes a one-click kill button for hung sessions
- **Auth** — reads credentials, surfaces your tier, displays OAuth scopes, and tracks token expiry with color-coded badges
- **Telemetry** — displays recent telemetry events directly from `~/.claude/telemetry/`

![System Processes](screenshots/system-view.png)
![System Auth](screenshots/system-auth.png)

### Settings & Configuration
- **General** — fully GUI-driven settings for Effort Level, Default Permission Mode, Environment Variables, and Status Line Command
- **Hooks (with Inline Test Runner)** — manage `PreToolUse`, `PostToolUse`, `Notification`, and `Stop` hooks. Includes an inline test runner to execute and debug your hook commands live with stdout/exit codes
- **MCP Servers** — graphical interface to add, configure, and manage your MCP Servers
- **Profiles** — snapshot and restore different Claude `settings.json` profiles
- **Notifications & Budget Limits** — desktop notifications for task completions, team creation, and cost thresholds. Also includes Budget Limits to prevent runaway agent costs
- **Templates** — save existing team topologies as templates and load them instantly for new projects

![Settings General](screenshots/settings-general.png)
![Settings Hooks](screenshots/settings-hooks.png)
![Settings MCP](screenshots/settings-mcp.png)
![Settings Notifications](screenshots/settings-notifications.png)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 40 |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Build | Vite 7, electron-builder |
| Charts | Recharts 3 |
| Graph Visualization | @xyflow/react (React Flow) v12 |
| File Watching | chokidar 5 |
| Icons | lucide-react |

## Prerequisites

- Node.js 18+
- npm 9+ (or compatible package manager)

## Installation

```bash
gh repo clone shansin/claude-lens
cd claude-lens
npm install
```

## Usage

### Development

```bash
npm run dev
```

Starts Vite dev server and Electron concurrently. DevTools open automatically in detached mode.

### Production Build

```bash
npm run build
```

Compiles TypeScript (electron), bundles the renderer with Vite, then packages with electron-builder. Output goes to `release/`.

| Platform | Format |
|---|---|
| macOS | `.dmg` |
| Windows | NSIS installer |
| Linux | `AppImage` |

## Project Structure

```
claude-lens/
├── electron/
│   ├── main.ts          # Electron main process, IPC handlers, file watcher, cost scanner
│   ├── preload.ts       # Context bridge (renderer ↔ main)
│   └── modules/
│       ├── analytics.ts    # Usage/activity analytics IPC
│       ├── content.ts      # Memory/content file handlers
│       ├── metrics.ts      # Agent metrics aggregation
│       ├── notifications.ts # Desktop notification logic
│       ├── settings.ts     # Claude settings read/write
│       ├── system.ts       # Process monitor, auth, telemetry
│       └── viewer.ts       # Conversation JSONL reader
├── src/
│   ├── App.tsx           # Root layout, view routing, command palette
│   ├── components/
│   │   ├── views/        # Top-level views (Cards, Graph, Split, Analytics, …)
│   │   └── *.tsx         # Shared components (AgentPill, CostPanel, UsageChart, …)
│   ├── hooks/
│   │   └── useTeamData.ts # Main data hook — wires IPC events to React state
│   └── types.ts          # Shared TypeScript types
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Data Sources

Claude Lens reads exclusively from `~/.claude/` and never modifies your conversation history.

| Path | What it reads |
|---|---|
| `~/.claude/teams/*/config.json` | Team metadata and member list |
| `~/.claude/tasks/*/` | Task JSON files per team |
| `~/.claude/projects/*/` | Session JSONL files (conversations + usage) |
| `~/.claude/settings.json` | Claude Code settings |
| `~/.claude/settings.local.json` | Local settings overrides |

Write operations are limited to: deleting/archiving teams, clearing tasks, updating settings, and managing hooks/MCP config — all triggered explicitly by the user.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Escape` | Close command palette / modal |

## License

ISC
