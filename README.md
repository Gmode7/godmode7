# AI-Native Backend v1.3

Chat-based interface for AI development workflows.

## Quick Start on Replit

### 1. Upload & Extract
Upload this zip and extract in workspace root.

### 2. Add Replit Secrets
Go to **Secrets** tab and add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `file:./data/dev.db` |
| `DATA_DIR` | `./data` |
| `PORT` | `3000` |

### 3. Run Setup
In Shell:
```bash
npm install -g pnpm
pnpm install
mkdir -p data
pnpm db:generate
pnpm db:push
pnpm bootstrap
```

### 4. Save API Key
Copy the key from bootstrap output and add to Secrets:

| Key | Value |
|-----|-------|
| `API_KEY` | `ainb_...` |

### 5. Run
```bash
pnpm dev:all
```

Or just click **Run** button.

## Chat Commands

| Command | Description |
|---------|-------------|
| `help` | Show all commands |
| `status` | System health |
| `projects` | List projects |
| `jobs` | List jobs |
| `gates` | Gate definitions |
| `create project [name]` | Create project |
| `create job [projectId]` | Create job |

## API Endpoints

- `GET /health` - Health check
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/jobs` - List jobs
- `POST /api/v1/jobs` - Create job
- `GET /api/v1/gates/definitions` - Gate info
- `GET /api/v1/chat/messages` - Chat history
- `POST /api/v1/chat/messages` - Send message

All API calls require `x-api-key` header.

## Files

```
├── apps/
│   ├── api/        # Express server
│   └── web/        # React chat UI
├── packages/
│   └── core/       # Shared logic
├── prisma/         # Database schema
└── scripts/        # Bootstrap
```
