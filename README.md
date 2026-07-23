# Software Maintenance Engineer

An AI-powered automated software maintenance system that connects to GitHub repositories, analyzes issues, generates code fixes using AI agents, validates builds, and creates pull requests — all fully automated.

## 🚀 Overview

**Software Maintenance Engineer** is an intelligent automation platform that autonomously resolves software issues in GitHub repositories. It uses AI language models (via OpenRouter) to understand reported issues, locate relevant files in the codebase, generate precise code fixes, validate those fixes (build verification), and create pull requests — closing the loop between issue reporting and resolution.

### Key Capabilities

- **Issue-Driven Fix Generation**: Automatically fetches open issues from any GitHub repository and analyzes them to produce code fixes.
- **AI-Powered Code Analysis**: Uses advanced LLMs (via OpenRouter) to navigate the codebase, identify relevant files, and generate targeted search/replace patches.
- **Multi-Ecosystem Build Validation**: Supports build verification for Node.js, Java (Maven/Gradle), Rust, Go, and Python projects.
- **Autonomous Build Repair**: If a build fails after applying a fix, the system re-engages the AI agent to diagnose and resolve the build error.
- **GitHub Pull Request Automation**: Commits changes to a working branch and automatically raises a Pull Request with a descriptive title and body.
- **Webhook-Triggered Workflows**: Responds to GitHub issue creation/reopening and CI failure webhooks to trigger automated maintenance pipelines.
- **Background Job Processing**: Uses BullMQ with Redis for reliable, queue-based asynchronous pipeline execution.
- **User-in-the-Loop**: If the AI agent needs clarification, it pauses and requests user input before proceeding.

## 🏗 Architecture

The system follows a layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Express.js API                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │  Auth    │  │  GitHub  │  │ Pipeline │  │  Webhooks   │ │
│  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes     │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │              │             │               │        │
│  ┌────▼──────────────▼─────────────▼───────────────▼──────┐ │
│  │                 Controller Layer                        │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │                   Services Layer                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ GitHub Svc   │  │ Pipeline Svc │  │  Repo Svc    │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │ │
│  └─────────┼─────────────────┼──────────────────┼─────────┘ │
│            │                 │                  │            │
│  ┌─────────▼─────────────────▼──────────────────▼─────────┐ │
│  │                    Agents Layer                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ File Locater │  │  Issue Fix   │  │  Build Fix   │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │              Validation Layer                           │ │
│  │  ┌──────────────┐  ┌──────────────┐                   │ │
│  │  │ Detect Proj  │  │  Run Build   │                   │ │
│  │  └──────────────┘  └──────────────┘                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│           Infrastructure Layer                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ BullMQ   │  │  Redis   │  │ Prisma   │  │ PostgreSQL │ │
│  │ (Queue)  │  │ (Broker) │  │  (ORM)   │  │  (DB)      │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Tech Stack

| Component            | Technology                                      |
|----------------------|-------------------------------------------------|
| **Runtime**          | Node.js (TypeScript)                            |
| **Framework**        | Express.js                                      |
| **AI/LLM**          | OpenRouter API (multi-model, configurable)      |
| **Database**         | PostgreSQL with Prisma ORM                      |
| **Queue System**     | BullMQ with Redis                               |
| **Git Operations**   | simple-git                                      |
| **GitHub Integration** | Octokit (GitHub App + OAuth)                 |
| **Validation**       | Multi-ecosystem build detection & execution     |
| **Authentication**   | JWT (Access + Refresh tokens) + GitHub OAuth    |

## 📂 Project Structure

```
├── src/
│   ├── agents/                     # AI agent implementations
│   │   ├── build-fix.agent.ts      # Build error diagnosis & fix agent
│   │   ├── file-locater.agent.ts   # Locates relevant files for an issue
│   │   └── issue-fix.agent.ts      # Main issue-fixing interactive agent
│   ├── config/                     # Configuration modules
│   │   ├── github.ts               # GitHub App initialization
│   │   ├── nvidia.ts               # NVIDIA API client (re-exports OpenRouter)
│   │   ├── openrouter.ts           # OpenRouter AI client setup
│   │   ├── prisma.ts               # Prisma database client
│   │   └── redis.config.ts         # Redis connection configuration
│   ├── context/
│   │   └── pipeline.context.ts     # Pipeline execution context (logging)
│   ├── controller/                 # Express route handlers
│   │   ├── auth.controller.ts      # Sign-up, sign-in, log-out
│   │   ├── github.controller.ts    # Issues, file tree, cloning, cleanup
│   │   ├── oauth.controller.ts     # GitHub OAuth login flow
│   │   ├── pipeline.controller.ts  # Pipeline job enqueue & status
│   │   └── webhook.controller.ts   # GitHub webhook event handling
│   ├── middleware/
│   │   ├── admin.middleware.ts      # Admin role authorization
│   │   └── login.middleware.ts      # Authentication middleware
│   ├── models/
│   │   └── user.model.ts           # User type definition
│   ├── queue/
│   │   ├── pipeline.queue.ts       # BullMQ queue definition
│   │   └── pipeline.worker.ts      # Queue worker processing logic
│   ├── routes/
│   │   ├── auth.route.ts           # Auth & OAuth routes
│   │   ├── health.routes.ts        # Health check endpoint
│   │   ├── pipeline.routes.ts      # Pipeline management routes
│   │   ├── repo.routes.ts          # GitHub repository data routes
│   │   └── webhook.routes.ts       # Webhook receiver routes
│   ├── services/
│   │   ├── github.service.ts       # GitHub API interactions
│   │   ├── pipeline.service.ts     # Core pipeline orchestration
│   │   └── repo.service.ts         # Repository CRUD via Prisma
│   ├── tools/
│   │   ├── agentRunner.ts          # Interactive LLM tool-loop runner
│   │   └── agentTools.ts           # Tool definitions & execution
│   ├── utils/
│   │   ├── applyFixes.ts           # Search/replace fix application
│   │   ├── applyPatch.ts           # Unified diff patch application
│   │   ├── clone.utils.ts          # Repository cloning utilities
│   │   ├── closeIssue.ts           # GitHub issue closing
│   │   ├── cookieOptions.ts        # Cookie configuration
│   │   ├── fileContent.ts          # File content reader
│   │   ├── git.utils.ts            # Git branch setup utilities
│   │   ├── log.ts                  # Database log writer
│   │   ├── pullrequest.ts          # Commit, push, and PR creation
│   │   └── token.ts                # JWT token generation/verification
│   ├── validation/
│   │   ├── detectProject.ts        # Project ecosystem detection
│   │   ├── runBuild.ts             # Build command execution
│   │   └── validateRepository.ts   # Orchestration entry point
│   └── index.ts                    # Application entry point
├── prisma/
│   ├── schema.prisma               # Prisma database schema
│   └── migrations/                 # Database migrations
├── documentation/
│   ├── agents.md                   # Agent system documentation
│   ├── api-reference.md            # API endpoint reference
│   ├── architecture.md             # Detailed architecture doc
│   ├── queue-worker.md             # Queue & worker documentation
│   ├── setup-deployment.md         # Setup & deployment guide
│   └── validation.md               # Validation layer documentation
├── package.json
├── tsconfig.json
├── prisma.config.ts
└── .gitignore
```

## 🔧 Setup & Installation

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** database
- **Redis** server (for BullMQ queue)
- **GitHub App** created on your GitHub account
- **GitHub OAuth App** (for user authentication)
- **OpenRouter API key** (or compatible OpenAI API key)

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/software_maintenance

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# GitHub App (for automated repository operations)
APP_ID=your_github_app_id
PRIVATE_KEY_PATH=path/to/private-key.pem
CLIENT_ID=your_github_oauth_client_id
CLIENT_SECRET=your_github_oauth_client_secret

# JWT Secrets
ACCESS_TOKEN_SECRET=your_jwt_access_secret
REFRESH_TOKEN_SECRET=your_jwt_refresh_secret

# OpenRouter / AI Model
OPENROUTER_API_KEY=your_openrouter_api_key
AI_MODEL=deepseek/deepseek-v4-flash

# Optional: GitHub Personal Access Token (fallback)
GITHUB_PAT=your_personal_access_token

# Optional: Agent iteration limits
MAX_ITERATIONS=10
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd software-maintenance-engineer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   npx prisma migrate dev
   ```

4. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Start the server**
   ```bash
   npm start
   ```

   For development with hot-reload:
   ```bash
   npm run dev
   ```

### Docker Setup (Alternative)

*Coming soon — Docker Compose configuration will include PostgreSQL, Redis, and the application service.*

## 🎯 Usage

### API Endpoints

**Authentication**
- `GET /auth/github/login` — Initiate GitHub OAuth login
- `GET /auth/github/callback` — GitHub OAuth callback
- `POST /auth/logout` — Log out (requires authentication)

**GitHub Repository Data**
- `GET /github/user/repos` — Fetch authenticated user's repositories
- `GET /github/users/:username/repos` — Fetch public repos for a user
- `GET /github/repos/:owner/:repo/issues` — Fetch repository issues
- `GET /github/repos/:owner/:repo/tree` — Fetch full file tree (default branch)
- `GET /github/repos/:owner/:repo` — Fetch issues + file tree combined
- `GET /github/repos/:owner/:repo/clone` — Clone repository locally
- `GET /github/repos/:owner/:repo/clean` — Remove local clone

**Pipeline (Automated Fix Workflow)**
- `GET /pipeline/repos/:owner/:repo/start` — Start automated analysis & fix pipeline
- `GET /pipeline/jobs/:jobId` — Check pipeline job status
- `POST /pipeline/jobs/:jobId/reply` — Provide user response to agent query

**Webhooks (GitHub Integration)**
- `POST /webhooks/github` — Receive GitHub webhook events

**Health**
- `GET /health` — Health check endpoint

### Pipeline Workflow

1. **Trigger**: Start via API (`/pipeline/repos/:owner/:repo/start`) or automatically when a GitHub issue is opened/reopened (webhook).
2. **Fetch**: Issues and full recursive file tree are fetched from GitHub.
3. **Clone**: The repository is cloned to a local workspace.
4. **Locate**: The File Locater AI agent identifies which files are most relevant to the reported issue(s).
5. **Generate Fix**: The Issue Fix AI agent interactively explores the codebase using reading/searching tools, then produces search/replace code fixes.
6. **Apply Fix**: Changes are applied to the local repository files.
7. **Validate**: The project ecosystem is auto-detected (Node.js, Maven, Gradle, Rust, Go, Python), and a build command is executed to verify correctness.
8. **Build Fix (if needed)**: If the build fails, the Build Fix agent diagnoses and attempts to repair the build error.
9. **Push & PR**: If validation passes, changes are committed, pushed to a working branch, and a Pull Request is created on GitHub.
10. **Close Issues**: The resolved issues are automatically closed with a comment linking to the PR.

## 🤖 AI Agent System

The system uses three specialized AI agents powered by configurable LLMs via OpenRouter:

### 1. File Locater Agent
- **Purpose**: Given an issue description and the repository file tree, identifies the most relevant files to examine.
- **Model**: Configurable via `AI_MODEL` environment variable.
- **Output**: JSON array of file paths.

### 2. Issue Fix Agent
- **Purpose**: Interactively explores the codebase and generates code fixes for reported issues.
- **Capabilities**: Can read files, search code, list directories, find symbol references, and ask for user clarification.
- **Output**: Search/replace blocks or unified diff patches.

### 3. Build Fix Agent
- **Purpose**: Diagnoses and resolves build failures that occur after applying issue fixes.
- **Capabilities**: Same interactive toolset as Issue Fix Agent.
- **Triggered automatically** when initial build validation fails.

### Agent Tools

All agents have access to these local tools:
- `read_file` — Read specific file contents with optional line ranges
- `read_multiple_files` — Batch read multiple files
- `search_codebase` — Search for strings/patterns across files
- `list_directory` — List files in a directory
- `find_references` — Find symbol references across the codebase
- `ask_user` — Request clarification from the user
- `submit_fix` — Submit final code changes
- `create_file` — Create new files in the repository

## ✅ Validation System

The validation layer automatically detects the project ecosystem and runs the appropriate build command:

| Project Type | Detection File | Build Command |
|-------------|----------------|---------------|
| **Node.js** | `package.json` | `npm run build` or `npx tsc --noEmit` |
| **Maven** | `pom.xml` | `mvn clean compile` (or wrapper) |
| **Gradle** | `build.gradle` / `build.gradle.kts` | `gradle build` (or wrapper) |
| **Rust** | `Cargo.toml` | `cargo build` |
| **Go** | `go.mod` | `go build ./...` |
| **Python** | `pyproject.toml` / `requirements.txt` | `python -m py_compile` |

## 📊 Database Schema (Prisma)

The system uses PostgreSQL with Prisma ORM. Key models include:

- **User** — Application users with GitHub OAuth and email/password auth
- **Repository** — Tracked GitHub repositories
- **Job** — Pipeline execution records with status tracking
- **Log** — Granular job execution logs
- **PullRequest** — PR records linked to completed jobs

## 📚 Documentation

Detailed documentation is available in the `documentation/` directory:

- [`architecture.md`](documentation/architecture.md) — In-depth architecture overview
- [`agents.md`](documentation/agents.md) — AI agent system details
- [`api-reference.md`](documentation/api-reference.md) — Complete API endpoint reference
- [`queue-worker.md`](documentation/queue-worker.md) — BullMQ queue & worker setup
- [`setup-deployment.md`](documentation/setup-deployment.md) — Production deployment guide
- [`validation.md`](documentation/validation.md) — Validation system internals

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

---

*Built with ❤️ for automated software maintenance.*