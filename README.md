# Claude Lens

A desktop GUI for monitoring and managing Claude Code agent teams. Built with Electron, React, and TypeScript, Claude Lens gives you a real-time window into your `~/.claude` directory — teams, tasks, conversations, costs, and system health, all in one place.

## Features

### Team & Task Management
- **Card View** — compact grid of all active teams with status badges, task counts, and cost summaries
- **Graph View** — interactive node-graph showing agent relationships and team topology (powered by React Flow)
- **Split View** — side-by-side team list + detail panel for focused task inspection
- Per-team actions: delete, archive (moves to `~/.claude/teams-archive/`), clear tasks, reveal in Finder/Files, copy team name
- Real-time filesystem watcher (chokidar) pushes updates to the UI without manual refresh

### Projects View
- Scans `~/.claude/projects/` and surfaces all Claude Code projects with session history
- Per-project metrics: total input/output tokens, cache tokens, estimated cost, last activity
- Session timeline showing which teams were active in each project
- Quick-open working directory from the app

### Analytics View
- **Overview** — daily token usage bar chart (input, output, cache)
- **Heatmap** — GitHub-style activity heatmap of sessions over time
- **Models** — side-by-side model comparison chart across sessions
- **Activity Feed** — chronological log of all assistant turns

### Conversation View
- Browse and read full conversation histories from any project session
- Plans viewer and Todos viewer embedded per-conversation
- Agent metrics panel showing per-agent token usage and cost
- Cost panel with per-session breakdown

### Search View
- Full-text search across all JSONL session files
- Click any result to jump directly into the Conversation View for that session

### Content View
- Browse memory files (`~/.claude/projects/*/memory/`) and other content artifacts

### System View
- **Processes** — live list of running Claude-related processes
- **Auth** — current authentication status
- **Telemetry** — telemetry configuration panel

### Settings View
- **General** — theme (light/dark/system), Claude directory path, auto-refresh interval
- **Hooks** — view and manage Claude Code hooks configuration
- **MCP Servers** — inspect and edit MCP server definitions from `claude_desktop_config.json`
- **Profiles** — manage multiple Claude settings profiles
- **Notifications** — configure desktop notifications for task completions, team creation, cost thresholds
- **Templates** — save and reuse team configuration templates

### Command Palette
Press `Ctrl+K` / `Cmd+K` to open the command palette for instant navigation to any view, team, or project.

### Cost Tracking
- Reads and parses all JSONL conversation files from `~/.claude/projects/`
- Deduplicates messages by ID to avoid double-counting
- Calculates USD cost per session using current Anthropic pricing for all Claude model families (Opus, Sonnet, Haiku — versions 3 through 4.6)
- Aggregates costs per team and per project

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 40 |
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Build | Vite 7, electron-builder |
| Charts | Recharts |
| Graph | @xyflow/react (React Flow) |
| File watching | chokidar |
| Icons | lucide-react |

## Prerequisites

- Node.js 18+
- npm 9+ (or compatible package manager)

## Installation

```bash
git clone <repo-url>
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
