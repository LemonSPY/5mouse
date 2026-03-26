# 5mouse 🐭

AI-powered software builder. Describe an idea, get a plan, approve it, and watch it get built — all from a chat interface.

## How It Works

1. **Describe** — Type your software idea in the chat
2. **Plan** — Claude generates a detailed implementation plan
3. **Approve** — Review the plan, approve or request changes
4. **Build** — Claude builds the entire project autonomously
5. **Iterate** — Request modifications through chat
6. **Ship** — Push to GitHub with one click

## Prerequisites

- **Node.js 20+**
- **Claude Code CLI** installed and authenticated (`npm install -g @anthropic-ai/claude-code`)
- **Git** installed
- **Anthropic API key** (set `ANTHROPIC_API_KEY`)
- **GitHub token** (optional, for pushing repos — set `GITHUB_TOKEN`)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# 3. Install tsx for running the custom server
npm install -D tsx

# 4. Start development server
npx tsx server.ts
```

Open http://localhost:3000 in your browser.

## Docker

```bash
# Build and run
docker compose up --build

# Or with env vars inline
ANTHROPIC_API_KEY=sk-ant-... docker compose up --build
```

## Project Structure

```
5mouse/
├── server.ts                          # Custom server with Socket.IO
├── src/
│   ├── app/                           # Next.js pages + API routes
│   ├── lib/                           # Core logic
│   │   ├── claude-orchestrator.ts     # Claude CLI subprocess wrapper
│   │   ├── prompt-templates.ts        # Plan/Build/Modify prompts
│   │   ├── state-machine.ts           # Project workflow states
│   │   ├── project-manager.ts         # SQLite DB + CRUD
│   │   ├── git-manager.ts            # Git + GitHub operations
│   │   └── workflow-engine.ts         # Ties everything together
│   ├── hooks/useSocket.ts            # Client-side Socket.IO hook
│   ├── components/                    # React UI components
│   └── types/index.ts                # Shared TypeScript types
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude CLI |
| `GITHUB_TOKEN` | No | GitHub PAT for creating/pushing repos |
| `DATA_DIR` | No | Data directory path (default: `./data`) |
| `PORT` | No | Server port (default: `3000`) |

## License

MIT