# Comprehensive Codebase Audit Report

**Project:** AI-Native Backend (GM7) v1.3.0
**Date:** 2026-02-17
**Auditor:** Automated deep audit

---

## Executive Summary

| Severity | Count |
|----------|-------|
| **CRITICAL** | 5 |
| **HIGH** | 12 |
| **MEDIUM** | 18 |
| **LOW** | 11 |
| **TOTAL** | **46** |

The codebase implements a multi-agent AI software agency platform with Express API, React frontend, and Prisma/SQLite database. While the architecture is well-structured and separation of concerns is good, there are **critical security issues** (XSS vulnerability, missing input validation on core routes, dev bypass key leakage risk), **high-severity problems** (no graceful shutdown, PrismaClient connection leak from multiple instantiations, zod version conflicts, missing `.env.example`), and numerous medium/low issues around code quality and production readiness.

---

## 1. Project Structure Audit

### 1.1 Directory Map

```
godmode7/
├── apps/
│   ├── api/                    # Express API server
│   │   ├── src/
│   │   │   ├── index.ts        # Main app entry, inline route handlers
│   │   │   ├── index.ts.bak    # ⚠ ORPHANED: backup of old entry
│   │   │   ├── llm/            # LLM provider modules
│   │   │   │   ├── openai.ts   # OpenAI client (PM, Intake, QA, Security)
│   │   │   │   ├── kimi.ts     # Kimi/Moonshot client (Architect, Docs)
│   │   │   │   └── claude.ts   # Anthropic Claude client (Engineer)
│   │   │   ├── middlewares/     # Auth, rate limiting, error handling
│   │   │   ├── routes/         # Route modules (admin, intake, pm, tech, eng, qa, security, docs)
│   │   │   ├── types/          # Express type augmentations
│   │   │   └── utils/          # Hash, IP key gen, plans, scopes
│   │   └── package.json
│   └── web/                    # React + Vite frontend
│       ├── src/
│       │   ├── components/     # UI components + layout
│       │   ├── lib/            # API client + store
│       │   └── pages/          # Dashboard, Projects, Jobs, Chat, Agents, Settings
│       └── package.json
├── packages/
│   └── core/                   # Shared library (crypto, gates engine, schemas)
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── dev.db                  # ⚠ SQLite dev DB committed to repo
│   └── seed.ts                 # Seed script
├── scripts/
│   ├── bootstrap.js            # Bootstrap agent registry + API keys
│   └── seed-intake.ts          # One-off intake agent seed
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # pnpm workspace definition
├── index.js                    # ⚠ ORPHANED: empty file (1 line)
└── AUDIT_REPORT.md             # This file
```

### 1.2 Findings

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| S-1 | LOW | **Orphaned file:** `index.ts.bak` is a full backup of the old monolithic entry point. Should be deleted. | `apps/api/src/index.ts.bak` | — |
| S-2 | LOW | **Orphaned file:** `index.js` at repo root is empty (1 line). Should be deleted. | `index.js` | 1 |
| S-3 | MEDIUM | **SQLite dev.db committed to repo.** Contains seeded data, potentially API key hashes. Add to `.gitignore`. | `prisma/dev.db` | — |
| S-4 | LOW | **Duplicated helper functions:** `getArtifactByType`, `getIntakeArtifact`, `getAdrArtifacts` are copy-pasted identically across `pm.ts`, `tech.ts`, `eng.ts`, `qa.ts`, `security.ts`, `docs.ts`. Should be extracted to a shared utility. | `apps/api/src/routes/*.ts` | — |
| S-5 | MEDIUM | **Workspace config inconsistency:** `pnpm-workspace.yaml` correctly lists `apps/*` and `packages/*`, but there is no `tsconfig.json` at the API level or root for compilation/IDE support. | `pnpm-workspace.yaml` | — |

---

## 2. Dependencies Audit

### 2.1 Version Conflicts

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| D-1 | **HIGH** | **Zod version conflict across workspaces.** Root has `zod@^4.3.6`, API has `zod@^3.25.76`, core has `zod@^3.22.4`. Zod v4 is a breaking upgrade — the root and API packages will resolve to incompatible major versions. | `package.json` (root:28, api:16, core:6) |
| D-2 | MEDIUM | **`@prisma/client` version mismatch.** Root pins `5.22.0`, API uses `^5.22.0` (range). These should be aligned. | `package.json` (root:24, api:11) |
| D-3 | MEDIUM | **Unused root dependencies.** `cors`, `express-rate-limit`, `helmet`, and `@types/cors` are declared at root `package.json` but only used in `apps/api`. They should be in the API workspace only. | `package.json` (root) |
| D-4 | LOW | **No `@types/express` in root** but `@types/cors` is there. Inconsistent. | `package.json` (root:16) |

### 2.2 Missing Dependencies

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| D-5 | MEDIUM | **`express` not declared at root** but used by API. The workspace link resolves this, but if `apps/api` is built standalone it will fail. This is acceptable for workspace-only usage. | — |
| D-6 | LOW | **No lockfile for pnpm.** `package-lock.json` (npm) is present but should be `pnpm-lock.yaml`. The npm lockfile is untracked (in git status). | — |

### 2.3 Outdated Dependencies

| ID | Severity | Finding | Location |
|----|----------|---------|----------|
| D-7 | LOW | **React 18.2** — React 19 is available. Non-blocking but worth noting. | `apps/web/package.json` |
| D-8 | LOW | **Vite 5** — Vite 6 is available. | `apps/web/package.json` |

---

## 3. Prisma / Database Audit

### 3.1 Schema Analysis

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| P-1 | **HIGH** | **Hardcoded SQLite dev database URL.** `schema.prisma` hardcodes `url = "file:./dev.db"` instead of using `env("DATABASE_URL")`. This means the `DATABASE_URL` env var is ignored and migrations/production always hit the dev DB. | `prisma/schema.prisma` | 7 |
| P-2 | MEDIUM | **Missing indexes on `Artifact.jobId` and `Artifact.type`.** Queries like `findMany({ where: { jobId, type }})` (used in every route) will table-scan without an index. | `prisma/schema.prisma` | 33-41 |
| P-3 | MEDIUM | **Missing index on `ChatMessage.createdAt`.** Chat messages are queried with `orderBy: { createdAt: 'asc' }` and `take: 100` — no index to support this. | `prisma/schema.prisma` | 83-88 |
| P-4 | LOW | **Missing index on `Job.projectId`.** Jobs are filtered by `projectId` but no index exists. | `prisma/schema.prisma` | 22 |
| P-5 | MEDIUM | **No migrations directory.** The project uses `prisma db push` only. This is acceptable for dev but not for production — there's no migration history, making schema changes risky. | `prisma/` | — |
| P-6 | LOW | **SQLite in production?** No PostgreSQL/MySQL config exists. SQLite is fine for prototyping but has concurrency limitations for a multi-agent system. | `prisma/schema.prisma` | 5-7 |

### 3.2 SQL/Query Safety

| ID | Severity | Finding |
|----|----------|---------|
| P-7 | LOW | **No raw SQL queries found.** All database access uses Prisma Client, which is parameterized. No SQL injection risk. |

---

## 4. API Security Audit

### 4.1 Authentication

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| A-1 | **CRITICAL** | **Dev bypass allows unauthenticated access in non-production.** In `auth.ts:18-46`, when `NODE_ENV !== 'production'` and no `x-api-key` header is sent, the middleware falls through with `req.plan = "basic"` and `req.scopes = []`. This means **any request without an API key in dev mode gets through auth with no scopes** — but the inline routes in `index.ts` (projects, jobs, gates, artifacts, chat) still work because `requireScope` checks happen per-route and will reject scopeless requests. However, the `errorHandler` middleware ordering is correct. The real issue: if `DEV_API_KEY` is set but an attacker sends no key, they still get through with empty scopes. | `apps/api/src/middlewares/auth.ts` | 18-46 |
| A-2 | **HIGH** | **Bootstrap script creates API key with wildcard scope `*`.** The `scripts/bootstrap.js:76` creates a key with `scopes: '*'`. The `parseScopes` function in `utils/scopes.ts` filters by `VALID_SCOPES`, so `'*'` parses to an **empty array** — meaning the bootstrap key has **zero scopes** and can't access any protected route. This is a functionality bug (bootstrap key is useless). | `scripts/bootstrap.js` | 76 |
| A-3 | MEDIUM | **`seed.ts` creates proper scoped keys** but `bootstrap.js` does not. The two scripts produce incompatible keys. Only `seed.ts` creates functional admin keys. | `prisma/seed.ts` vs `scripts/bootstrap.js` | — |

### 4.2 API Key Hashing

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| A-4 | LOW | **API key hashing is correctly implemented.** Both `apps/api/src/utils/hash.ts` and `packages/core/src/crypto/index.ts` use SHA-256. Keys are never stored in plaintext. Key is shown only once at creation time (`admin.ts:77`). | Multiple | — |
| A-5 | MEDIUM | **Duplicate `hashApiKey` implementations.** `apps/api/src/utils/hash.ts` and `packages/core/src/crypto/index.ts` both define `hashApiKey`. Routes import from `@ai-native/core`, while `auth.ts` imports from `../utils/hash.js`. They produce the same output, but this is fragile. | `apps/api/src/utils/hash.ts`, `packages/core/src/crypto/index.ts` | — |

### 4.3 Rate Limiting

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| A-6 | MEDIUM | **In-memory rate limit store (`planStores` Map).** The plan-based rate limiter uses a simple in-memory Map. This resets on server restart and doesn't work across multiple instances. | `apps/api/src/middlewares/rateLimiter.ts` | 24 |
| A-7 | LOW | **Rate limit tiers are properly configured** for basic/pro/business plans with differentiated global and chat limits. | `apps/api/src/utils/plans.ts` | 13-17 |

### 4.4 Input Validation

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| A-8 | **CRITICAL** | **No input validation on core routes.** The inline routes in `index.ts` for projects (POST `/api/v1/projects`), jobs (POST `/api/v1/jobs`), job transitions (POST `/api/v1/jobs/:id/transition`), artifacts (POST `/api/v1/artifacts`), and chat (POST `/api/v1/chat/messages`) accept `req.body` fields directly with **no Zod validation**. Any string/value can be passed for `name`, `clientId`, `strategy`, `targetState`, `content`, etc. | `apps/api/src/index.ts` | 235-313 |
| A-9 | **HIGH** | **Job state transition has no FSM validation.** `POST /api/v1/jobs/:id/transition` accepts any `targetState` string and writes it directly to the database. An attacker can set arbitrary states like `"HACKED"`. The `GatesEngine.getValidTransitions()` method exists but is never called on this endpoint. | `apps/api/src/index.ts` | 267-270 |
| A-10 | MEDIUM | **Route module endpoints have proper Zod validation.** All routes in `intake.ts`, `pm.ts`, `tech.ts`, `eng.ts`, `qa.ts`, `security.ts`, `docs.ts` use Zod schemas. Only the inline routes in `index.ts` are unvalidated. | `apps/api/src/routes/*.ts` | — |

### 4.5 CORS

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| A-11 | MEDIUM | **CORS allows all origins in dev mode.** When `CORS_ORIGINS` is empty and `NODE_ENV !== 'production'`, all origins are allowed. In production with empty `CORS_ORIGINS`, all origins are blocked. This is a reasonable strategy but should be documented. | `apps/api/src/index.ts` | 39-48 |
| A-12 | LOW | **Requests with no `Origin` header always pass CORS.** This is standard behavior (server-to-server, curl) and acceptable. | `apps/api/src/index.ts` | 42 |

### 4.6 Error Handling

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| A-13 | **HIGH** | **Stack traces leaked in non-production errors.** The `errorHandler` middleware exposes `err.stack` when `NODE_ENV !== 'production'`. This is intentional for dev but risky if the server is deployed without `NODE_ENV=production` set. | `apps/api/src/middlewares/errorHandler.ts` | 15 |
| A-14 | MEDIUM | **Route handlers in `index.ts` have no try/catch.** The inline project/job/gate/artifact routes have no error handling. An unhandled Prisma error (e.g., delete non-existent project) will crash with a 500 and leak the Prisma error message. | `apps/api/src/index.ts` | 230-313 |

---

## 5. Auth & Scopes Audit

### 5.1 Scope Enforcement

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| SC-1 | LOW | **Scope checking is correctly implemented.** Every protected route uses `requireScope()` or `requireAnyScope()`. The middleware correctly returns 403 if the scope is missing. | `apps/api/src/middlewares/requireScope.ts` | — |
| SC-2 | LOW | **Admin routes are double-protected.** `admin.ts` has `router.use(requireScope("admin:read"))` at the router level, plus individual endpoints add `requireScope("admin:write")` for mutations. This is correct. | `apps/api/src/routes/admin.ts` | 13 |
| SC-3 | MEDIUM | **No scope validation on inline admin routes in `index.ts`.** The `/api/v1/admin/status` endpoint at line 79 uses `requireScope('admin:read')`, but the `/api/v1/admin/agents` and `/api/v1/admin/agents/:id/ready` endpoints (lines 105, 129, 172) also correctly use `requireScope`. Inline routes for projects/jobs/chat use appropriate scopes. No privilege escalation found. | `apps/api/src/index.ts` | — |

### 5.2 API Key Expiry

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| SC-4 | LOW | **API key expiry is enforced.** `auth.ts:68-70` checks `expiresAt < new Date()` and rejects expired keys with 401. | `apps/api/src/middlewares/auth.ts` | 68-70 |

---

## 6. Code Quality Audit

### 6.1 TypeScript Issues

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| CQ-1 | MEDIUM | **Extensive use of `any` type.** Found across multiple files: `req: any` in `index.ts:235,324`, `err: any` in every catch block, `Promise<any>` return types on helper functions. Approximately 40+ usages of `any`. | Multiple | — |
| CQ-2 | LOW | **Missing TypeScript config for API.** No `tsconfig.json` in `apps/api/`. The project relies on `tsx` for transpilation which uses defaults. | `apps/api/` | — |
| CQ-3 | LOW | **Unsafe cast in MarkdownViewer.** `code({ node, inline, className, children, ...props }: any)` — react-markdown v10 changed the code component API. The `inline` prop was replaced. | `apps/web/src/components/MarkdownViewer.tsx` | 62 |

### 6.2 Error Handling

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| CQ-4 | **HIGH** | **Unhandled promise rejections on inline routes.** Routes in `index.ts` (lines 230-376) use `async` handlers but don't wrap database calls in try/catch. Express 4.x does not catch async errors by default — these will crash the process. | `apps/api/src/index.ts` | 230-376 |
| CQ-5 | MEDIUM | **No global uncaught exception handler.** There is no `process.on('uncaughtException')` or `process.on('unhandledRejection')` handler. Unhandled errors will crash the Node.js process. | `apps/api/src/index.ts` | — |

### 6.3 Hardcoded Secrets

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| CQ-6 | MEDIUM | **Placeholder API key in OpenAI client.** `new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder' })` — the fallback `'sk-placeholder'` is harmless (will fail auth) but shouldn't be there. | `apps/api/src/llm/openai.ts` | 11 |
| CQ-7 | LOW | **No hardcoded secrets found** in source code. API keys are generated at runtime and stored as hashes. Good. | — | — |

### 6.4 .env Documentation

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| CQ-8 | **HIGH** | **No `.env.example` file exists.** Required env vars are scattered across code: `DATABASE_URL`, `DATA_DIR`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`, `DEV_API_KEY`, `OPENAI_API_KEY`, `KIMI_API_KEY`, `KIMI_BASE_URL`, `KIMI_MODEL`, `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `OPENAI_MODEL`, `RATE_LIMIT_PER_MINUTE`, `CHAT_RATE_LIMIT_PER_MINUTE`. New developers have no documentation on what to configure. | — | — |

### 6.5 Console.log in Production

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| CQ-9 | MEDIUM | **~25+ `console.log`/`console.error`/`console.warn` statements.** Found in `index.ts` (404-407), all route files (catch blocks), all LLM modules, `auth.ts:92`, `seed.ts`, `bootstrap.js`. No structured logging library (e.g., pino, winston). All output goes to stdout with no log levels, timestamps, or correlation IDs. | Multiple | — |

### 6.6 Multiple PrismaClient Instances

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| CQ-10 | **HIGH** | **Multiple `new PrismaClient()` instantiations.** Found in: `index.ts:28`, `auth.ts:7`, `admin.ts:9`, `intake.ts:9`, `pm.ts:9`, `tech.ts:9`, `eng.ts:9`, `qa.ts:9`, `security.ts:9`, `docs.ts:15`, `seed.ts:4`, `bootstrap.js:4`, `seed-intake.ts:2`. That's **13 separate PrismaClient instances**. Each opens its own connection pool. This wastes connections and can cause SQLite locking issues. Should use a singleton. | Multiple | — |

---

## 7. Frontend Audit (apps/web)

### 7.1 Build Config

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| F-1 | LOW | **Vite config is properly set up.** Dev server proxies `/api` and `/health` to `localhost:3000`. `allowedHosts: true` is set for dev flexibility. | `apps/web/vite.config.ts` | — |
| F-2 | LOW | **No build optimization config** (no chunking strategy, no source map settings for production). | `apps/web/vite.config.ts` | — |

### 7.2 XSS Vulnerabilities

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| F-3 | **CRITICAL** | **XSS via `dangerouslySetInnerHTML` in Chat component.** `Chat.tsx:207` renders message content using `dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}`. The `formatContent` function at line 116 does regex replacement but **does not sanitize HTML**. A malicious chat message like `<img src=x onerror=alert(1)>` will execute JavaScript. Since messages come from the API (which stores user input in the DB), this is a stored XSS vulnerability. | `apps/web/src/pages/Chat.tsx` | 116-122, 207 |

### 7.3 API Base URL

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| F-4 | LOW | **API base URL is configurable.** Stored in localStorage via `lib/store.ts` with default `http://127.0.0.1:3000`. Configurable in Settings page. | `apps/web/src/lib/store.ts` | 11 |

### 7.4 Error Boundaries

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| F-5 | MEDIUM | **No React Error Boundary.** A rendering error in any component will crash the entire app with a white screen. Should wrap the app in an error boundary. | `apps/web/src/App.tsx` | — |

### 7.5 API Key Storage

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| F-6 | MEDIUM | **API key stored in localStorage in plaintext.** `lib/store.ts` stores the API key as plain text in `localStorage`. Any XSS vulnerability (see F-3) can exfiltrate it. | `apps/web/src/lib/store.ts` | 28 |

---

## 8. Gates Engine Audit

### 8.1 Gate Definitions

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| G-1 | MEDIUM | **Gate definitions are incomplete.** The `getGateDefinitions()` method returns only 5 gates (INTAKE_DONE, REQUIREMENTS_REVIEW, CODE_REVIEW, SECURITY_REVIEW, SBOM_AUDIT), but routes create additional gates: PRD_DONE, ARCH_DONE, PATCH_READY, TESTS_PLANNED, QA_MATRIX_DONE, QA_REPORT_DONE, THREAT_MODEL_DONE, SECURITY_REVIEW_DONE, SECURITY_FIX_PLAN_DONE, DOCS_DONE. These are not represented in the gate engine. | `packages/core/src/gates/engine.ts` | 30-37 |
| G-2 | MEDIUM | **`checkGate` only knows about 5 artifact types.** The `reqs` mapping only covers REQUIREMENTS_DOC, CODE_SNAPSHOT, SECURITY_SCAN, SBOM, intake_brief. The actual artifacts created by the system (prd, backlog, architecture, adr, engineering_plan, patch, test_plan, qa_matrix, etc.) are not recognized by the gate checker. | `packages/core/src/gates/engine.ts` | 12-15 |

### 8.2 Race Conditions

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| G-3 | MEDIUM | **No concurrency protection on job state transitions.** The `POST /api/v1/jobs/:id/transition` endpoint and the intake route's FSM advancement (`intake.ts:183-187`) do not use optimistic locking or transactions. Two concurrent requests could both read the same state and advance differently. | `apps/api/src/index.ts:267`, `apps/api/src/routes/intake.ts:183` | — |
| G-4 | LOW | **Gate upserts use compound unique key** (`jobId_gateType`), which prevents duplicate gates correctly. | `prisma/schema.prisma` | 54 |

---

## 9. Scripts Audit

### 9.1 Admin Scripts

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| SC-5 | MEDIUM | **No production safety guards on scripts.** `seed.ts` and `bootstrap.js` have no `NODE_ENV` check. Running `pnpm bootstrap` in production would create duplicate agents and potentially expose a new API key in server logs. | `prisma/seed.ts`, `scripts/bootstrap.js` | — |
| SC-6 | LOW | **Bootstrap script logs API key to console.** This is by design (shown once), but in production the key would appear in server logs which may be persisted. | `scripts/bootstrap.js` | 81-82 |
| SC-7 | LOW | **`seed-intake.ts` uses top-level await.** This requires ESM module mode which is configured, but the script has no error handling beyond the existing agent check. | `scripts/seed-intake.ts` | 3 |

### 9.2 Chat `deleteMany` Risk

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| SC-8 | MEDIUM | **`DELETE /api/v1/chat/messages` deletes ALL messages** with `prisma.chatMessage.deleteMany()` (no filter). This is a destructive operation available to any user with `chat:write` scope. Should require `admin:write` or have a confirmation mechanism. | `apps/api/src/index.ts` | 373-376 |

---

## 10. Production Readiness Audit

### 10.1 Deployment

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| PR-1 | **HIGH** | **No Dockerfile or deployment configuration.** No `Dockerfile`, `docker-compose.yml`, CI/CD config, or deployment scripts exist. The README references Replit only. | — | — |
| PR-2 | MEDIUM | **No `.env.example` or environment documentation.** ~15 env vars are used but undocumented. | — | — |

### 10.2 Health Check

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| PR-3 | **HIGH** | **Health endpoint does not verify DB connectivity.** `GET /health` returns `{ status: 'ok' }` without querying the database. A broken DB connection would still report healthy. | `apps/api/src/index.ts` | 56 |

### 10.3 Graceful Shutdown

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| PR-4 | **HIGH** | **No graceful shutdown handling.** There is no `SIGTERM`/`SIGINT` handler. The server doesn't close HTTP connections, drain requests, or disconnect PrismaClient on shutdown. This can cause data corruption on SQLite. | `apps/api/src/index.ts` | 404-408 |

### 10.4 Logging

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| PR-5 | MEDIUM | **No structured logging.** All logging uses `console.log`/`console.error` with no log levels, timestamps, request IDs, or JSON formatting. Not suitable for production log aggregation. | Multiple | — |

### 10.5 Environment Validation

| ID | Severity | Finding | File | Line |
|----|----------|---------|------|------|
| PR-6 | MEDIUM | **No startup environment validation.** The server starts regardless of whether required env vars are set. LLM modules log warnings but don't prevent startup. Missing `DATABASE_URL` is masked by the hardcoded SQLite path in `schema.prisma`. | Multiple | — |

---

## Prioritized Action Plan

### Phase 1: Critical Fixes (Do Immediately)

| Priority | Issue | Action |
|----------|-------|--------|
| 1 | **F-3** XSS in Chat | Replace `dangerouslySetInnerHTML` with a sanitizer (DOMPurify) or use react-markdown for chat messages. |
| 2 | **A-8** No input validation on core routes | Add Zod schemas to all inline routes in `index.ts` (projects, jobs, artifacts, chat, transitions). |
| 3 | **A-9** No FSM validation on transitions | Call `gatesEngine.getValidTransitions()` before allowing state changes. Reject invalid transitions. |
| 4 | **P-1** Hardcoded DB URL | Change `schema.prisma` to `url = env("DATABASE_URL")` and set the env var. |
| 5 | **A-2** Bootstrap key has wildcard `*` scope | Change `scripts/bootstrap.js` to use explicit scope list like `seed.ts` does. |

### Phase 2: High Priority (This Sprint)

| Priority | Issue | Action |
|----------|-------|--------|
| 6 | **CQ-10** Multiple PrismaClient instances | Create a shared `prisma.ts` singleton module, import everywhere. |
| 7 | **CQ-4** Unhandled async errors | Wrap all inline routes in try/catch or use `express-async-errors` package. |
| 8 | **PR-4** No graceful shutdown | Add SIGTERM/SIGINT handlers: close server, disconnect Prisma, drain connections. |
| 9 | **PR-3** Health check doesn't verify DB | Add `prisma.$queryRaw` or `.findFirst()` to the health endpoint. |
| 10 | **D-1** Zod version conflict | Align all packages to zod v3 (or v4 with migration). |
| 11 | **CQ-8** No `.env.example` | Create `.env.example` documenting all env vars with descriptions. |
| 12 | **A-13** Stack trace leakage | Ensure `NODE_ENV=production` is enforced in deploy config. Add startup warning if not set. |
| 13 | **PR-1** No Dockerfile | Create basic Dockerfile and docker-compose for deployment. |

### Phase 3: Medium Priority (Next Sprint)

| Priority | Issue | Action |
|----------|-------|--------|
| 14 | **S-3** dev.db in repo | Add `prisma/dev.db` to `.gitignore`, remove from tracking. |
| 15 | **F-5** No error boundary | Add React Error Boundary component wrapping `<Routes>`. |
| 16 | **F-6** API key in localStorage | Consider sessionStorage or httpOnly cookie approach. |
| 17 | **G-1/G-2** Incomplete gate definitions | Update gates engine to reflect all gates used by route modules. |
| 18 | **G-3** Race conditions on state transitions | Add optimistic locking (`updatedAt` check) or Prisma transactions. |
| 19 | **S-4** Duplicated helper functions | Extract shared artifact helpers to a common module. |
| 20 | **CQ-9/PR-5** Console.log everywhere | Replace with pino or winston structured logger. |
| 21 | **SC-5** No production guards on scripts | Add `NODE_ENV` check and confirmation prompt to seed/bootstrap scripts. |
| 22 | **SC-8** Bulk chat delete | Require `admin:write` scope for `DELETE /api/v1/chat/messages`. |
| 23 | **A-5** Duplicate hashApiKey | Remove `apps/api/src/utils/hash.ts`, use `@ai-native/core` everywhere. |
| 24 | **A-6** In-memory rate limit store | Document limitation. For multi-instance, switch to Redis-backed store. |
| 25 | **CQ-5** No global error handlers | Add `process.on('uncaughtException')` and `process.on('unhandledRejection')`. |
| 26 | **P-2/P-3/P-4** Missing DB indexes | Add `@@index` directives to schema for frequently queried columns. |

### Phase 4: Low Priority (Backlog)

| Priority | Issue | Action |
|----------|-------|--------|
| 27 | **S-1/S-2** Orphaned files | Delete `index.ts.bak` and root `index.js`. |
| 28 | **CQ-1** Excessive `any` usage | Gradually add proper types to catch blocks and helper functions. |
| 29 | **CQ-2** Missing API tsconfig | Add `tsconfig.json` to `apps/api/`. |
| 30 | **D-6** Wrong lockfile | Delete `package-lock.json`, ensure `pnpm-lock.yaml` is committed. |
| 31 | **CQ-3** MarkdownViewer code component | Update for react-markdown v10 API changes. |

---

## Appendix: File-by-File Summary

| File | Purpose | Issues |
|------|---------|--------|
| `apps/api/src/index.ts` | Main Express app, inline routes | A-8, A-9, A-14, CQ-4, CQ-10, PR-3, PR-4 |
| `apps/api/src/index.ts.bak` | Dead code | S-1 |
| `apps/api/src/middlewares/auth.ts` | Auth middleware | A-1, CQ-10 |
| `apps/api/src/middlewares/rateLimiter.ts` | Rate limiting | A-6 |
| `apps/api/src/middlewares/errorHandler.ts` | Error handler | A-13 |
| `apps/api/src/middlewares/requireScope.ts` | Scope checker | Clean |
| `apps/api/src/utils/hash.ts` | Crypto utils | A-5 (duplicate) |
| `apps/api/src/utils/plans.ts` | Plan tier config | Clean |
| `apps/api/src/utils/scopes.ts` | Scope definitions | Clean |
| `apps/api/src/utils/ipKeyGenerator.ts` | Rate limit key gen | Clean |
| `apps/api/src/routes/admin.ts` | Admin API keys/agents | Clean (good validation) |
| `apps/api/src/routes/intake.ts` | Intake agent | CQ-10 |
| `apps/api/src/routes/pm.ts` | PM agent | CQ-10 |
| `apps/api/src/routes/tech.ts` | Tech lead agent | CQ-10 |
| `apps/api/src/routes/eng.ts` | Engineer agent | CQ-10 |
| `apps/api/src/routes/qa.ts` | QA agent | CQ-10 |
| `apps/api/src/routes/security.ts` | Security agent | CQ-10 |
| `apps/api/src/routes/docs.ts` | Docs agent | CQ-10, reads index.ts from filesystem |
| `apps/api/src/llm/openai.ts` | OpenAI client | CQ-6 |
| `apps/api/src/llm/kimi.ts` | Kimi client | Clean |
| `apps/api/src/llm/claude.ts` | Claude client | Clean |
| `packages/core/src/gates/engine.ts` | Gate logic | G-1, G-2 |
| `packages/core/src/schemas/index.ts` | FSM + gate config | Clean |
| `packages/core/src/crypto/index.ts` | SHA-256 hashing | A-5 (duplicate) |
| `apps/web/src/pages/Chat.tsx` | Chat page | **F-3 (XSS)** |
| `apps/web/src/lib/store.ts` | localStorage manager | F-6 |
| `apps/web/src/App.tsx` | App shell | F-5 (no error boundary) |
| `prisma/schema.prisma` | DB schema | P-1, P-2, P-3, P-4, P-5 |
| `scripts/bootstrap.js` | Bootstrap script | A-2, SC-5 |
| `prisma/seed.ts` | Seed script | SC-5 |
