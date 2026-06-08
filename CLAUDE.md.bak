# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Development with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled server (node dist/index.js)
npm test             # Run all tests (vitest run)
npm run test:watch   # Run tests in watch mode (vitest)
npx vitest run test/some-file.test.ts   # Single test file
npm run lint         # ESLint on src/
```

**CLI args:** `--port <number>` (default 3000 or PORT env), `--data <path>` (default ./data or DATA_DIR env), `uninstall` subcommand

**Env vars:** `PORT`, `DATA_DIR`, `ENCRYPTION_KEY` (for config secret encryption; auto-generates if unset), `ADMIN_TOKEN` (Bearer token for admin API; no auth if unset)

## Architecture

Single-process Node.js server. No database — all data is Markdown/JSON files under `DATA_DIR` with Git auto-commits (30s debounce).

### Data Flow

```
Feishu webhook → webhook.ts → verify signature → find channel by chatId
  ├─ Command (@自己 交班) → handover-orchestrator.ts → save pending → send card with H5 link
  ├─ Message → record-service.ts → append raw + enqueue LLM task → llm-queue.ts
  │    └─ LLM analysis → update analysis.json + incrementalUpdatePreview (preview.md + preview-items.json) → notifyDraftUpdate (SSE)
  └─ Message Recalled → record-service.ts → append tombstone to raw.jsonl + mark analysis recalled + remove from preview → notifyDraftUpdate (SSE)

H5 Page → h5-api.ts
  ├─ GET  /draft/:code/events   → SSE endpoint for real-time updates (falls back to polling)
  ├─ GET  /draft/:code/status   → lightweight poll (raw count, analysis count, missing)
  ├─ GET  /draft/:code          → load draft data (raw count, analysis items, preview)
  ├─ PUT  /draft/:code/preview → save user edit → diff detection → experience learning → notifyDraftUpdate
  ├─ POST /draft/:code/assign-shift → mark item shift (current/next) → notifyDraftUpdate
  ├─ POST /handover/:code/start  → handleHandoverStart (save pending)
  ├─ POST /handover/:code/accept → handleHandoverAccept (archive or self-confirm)
  └─ POST /handover/:code/reject → handleHandoverReject (打回)

Memory Loop:
  buildContextPrompt() → soul + agents + channel-memory (纠错记录/禁忌) + experience (规则)
  User edits preview → detectDiffs() → recordDiffCandidate() → count≥2 → write channel-memory.md
  User edits preview → analyzeEditIntent() → addEntry() → experience.json
  Post-handover → dream-service → candidate memory → channel-memory.md
```

### Key Modules

- **App singleton** (`app.ts`): Holds `GitManager`, `LLMQueue`, wires auto-commit via `setAutoCommit()` into all services. Retrieved globally via `getApp()`.
- **LLM Queue** (`llm-queue.ts`): Per-channel FIFO ordering, global Semaphore (default concurrency 3), 2 retries with exponential backoff.
- **Channel Adapter** (`channels/`): `ChannelAdapter` interface → `FeishuAdapter`. Factory pattern supports adding WeChat Work/DingTalk. Commands detected by Chinese keywords after stripping @-mentions: 交班→START. `fetchMessageContent()` for reply context injection. Accept/reject handled via H5 page, not group chat commands.
- **Context Service** (`context-service.ts`): Loads previous handover records for LLM context injection during handover generation. Pure code, no LLM calls.
- **Config Service** (`config-service.ts`): Manages channel configs, LLM providers, templates, and system prompts. `getSystemPrompt()` returns per-channel prompt or default.
- **Draft Storage** (split across 4 files):
  - `draft-raw-service.ts`: Append-only `raw.jsonl` for raw message records. Never cleared on handover — writes a `handover_boundary` marker instead.
  - `draft-analysis-service.ts`: `analysis.json` for LLM analysis items, completeness checking. Supports `recalled` flag and `shift` assignment.
  - `draft-preview-service.ts`: `preview.md` for structured handover preview + `preview-items.json` for robust item tracking (survives user edits that remove HTML markers)
- **Record Service** (`record-service.ts`): Core message handler. `buildContextPrompt()` assembles soul + agents + channel-memory + experience for LLM prompt injection. Handles text/image/audio, enqueues LLM analysis. Also handles message retraction via `handleMessageRecalled()`. Notifies SSE via `setDraftUpdateNotifier()`.
- **Handover Orchestrator** (`handover-orchestrator.ts`): Both modes (requireAccept=true/false) save as pending and require H5 confirmation. Mode A requires a different person to accept; Mode B allows the sender to self-confirm.
- **Encryption** (`encryption.ts`): AES-256-GCM. Key from `ENCRYPTION_KEY` env (SHA-256 derived) or auto-generated random key persisted to `data/config/.encryption-key` (mode 0o600).

### Agent Intelligence Subsystem

- **Soul** (`soul-service.ts`): Per-channel persona in `soul.md`. Combined with agents text via `buildSoulPrompt()`.
- **Agents** (`agents-service.ts`): Per-channel behavioral rules in `agents.md`. Default rules: priority judgment, organization norms, taboos.
- **Channel Memory** (`channel-memory-service.ts`): `channel-memory.md` with sections: 用户偏好, 模式识别, 纠错记录, 禁忌. Only 纠错记录 and 禁忌 are injected into LLM prompts via `extractMemoryForPrompt()`. Diff candidates accumulate in `dreaming/candidates.json`; when a pattern repeats ≥2 times, auto-promoted to channel-memory.
- **Experience** (`experience-service.ts`): `experience.json` stores learned rules. `analyzeEditIntent()` compares LLM output vs user edit to infer intent and generate a rule. `buildExperiencePrompt()` formats rules for prompt injection.
- **Dream** (`dream-service.ts`): Post-handover reflection. When modification rate >30%, uses LLM to analyze diffs and generate candidate memory entries. High-confidence (≥0.8) auto-written; lower ones saved to `dreaming/reviews/` for manual review.
- **Diff Detector** (`diff-detector.ts`): Compares two `AnalysisItem` objects, returns field-level diffs (urgency/category/content changes).

### H5 Mobile Web

- **H5 API** (`h5-api.ts`): Draft viewing, preview editing (with diff detection + experience learning), handover start/accept/reject, SSE endpoint (`/draft/:code/events`), shift assignment. Exports `notifyDraftUpdate()` for SSE event bus.
- **H5 Auth** (`h5-auth.ts`): Feishu JS-SDK OAuth. Frontend calls `GET /api/h5/auth/feishu?code=xxx` to exchange auth code for user identity. Falls back to anonymous (`h5_user`) when auth unavailable.

### Model Routing

`llm-provider-factory.ts` supports per-task routing via `LLMRoutesConfig`:
- `getForTask('analyze')` — used for message analysis (webhook → record-service)
- `getForTask('review')` — for handover review/generation
- Falls back to `getDefault()` when no route is configured.

### DATA_DIR Structure

```
data/
  config/
    channels.json          # Channel configs
    llm-providers.json     # LLM provider configs (API keys encrypted, routes config)
    .encryption-key         # Auto-generated if no ENCRYPTION_KEY env
  channels/<code>/
    drafts/
      raw.jsonl             # Raw message records (append-only, never cleared; handover_boundary markers separate shifts)
      analysis.json         # LLM analysis items
      preview.md            # Structured handover preview (Markdown, <!-- msg:ID --> markers)
      preview-items.json    # Parallel structured item tracking (survives user edits)
      pending.json          # Pending handover state
    handovers/YYYY-MM/*.md  # Completed handover records (YAML frontmatter + Markdown)
    soul.md                 # Soul persona definition (Markdown, replaces former agent-soul.json)
    agents.md               # Agent behavioral rules
    experience.json         # Learned experience rules
    channel-memory.md       # Channel memory (纠错记录, 禁忌, etc.)
    template.md             # Per-channel handover template
    system-prompt.txt       # Per-channel system prompt (configurable, defaults in code)
    dreaming/
      candidates.json       # Diff candidates awaiting confirmation
      reviews/*.md          # Dream review records
    media/images/, audio/   # Downloaded media
  logs/app.log
```

## Conventions

- **All user-facing strings are in Chinese** (log messages, command keywords, card content, API errors)
- **channelCode** is the organizational key — partitions data dirs, LLM queues, and is regex-validated (`/^[a-zA-Z0-9_]{1,50}$/`)
- **Use `getDataDir()`** from `src/utils/data-dir.ts` — never `process.env.DATA_DIR` directly (needed for test isolation)
- **Admin route errors** use `sanitizeError()` helper — returns generic 'Internal error', logs details server-side
- **Admin API auth**: Protected by `ADMIN_TOKEN` Bearer auth middleware (`admin-auth.ts`). If `ADMIN_TOKEN` env var is unset, auth is skipped with a warning (dev mode). Production MUST set `ADMIN_TOKEN`.
- **H5 API auth**: Read operations (GET draft, SSE, status) use `h5OptionalAuth` (attaches session if present). Write operations (PUT preview, POST handover/*, POST assign-shift) use `h5RequireAuth` (rejects 401 if no valid session). Session tokens issued by Feishu OAuth via `session-token.ts` (HMAC-signed, 24h expiry).
- **Security middleware**: `securityHeaders` (X-Content-Type-Options, X-Frame-Options, etc.), `rateLimit` (60 req/min per IP on /api), SSE connection cap (50 concurrent)
- **Config atomic writes**: `saveChannelsConfig`/`saveLLMProvidersConfig` use `atomicWriteFile` (write tmp → rename) to prevent corruption
- **File lock timeout**: `acquireLock(key, timeoutMs=10000)` — deadlocks auto-expire after 10s
- **Auto-commit wiring**: Services export `setAutoCommit(fn)`, App calls them in `initialize()`. No direct App import from services.
- **LLM providers** must be OpenAI-compatible (`/chat/completions`). Add new providers by subclassing `BaseLLMProvider` and registering in `llm-provider-factory.ts` `providerClasses` map
- **No HTTP client library** — raw `http`/`https` modules in `base-provider.ts` and `feishu-client.ts`
- **Fallback without LLM**: If no default provider, messages still record to drafts but analysis returns `{ category: '未分类', content: text, urgency: 'normal' }`
- **Feishu signature**: SHA256(timestamp + nonce + encryptKey + body), NOT HMAC. Uses `timingSafeEqual`
- **Handover context**: Previous handover is loaded by `context-service.ts` (code) and injected into LLM prompt. LLM decides how to reference it — no hardcoded business logic in prompts.
- **System prompt**: Configurable per-channel via `system-prompt.txt`. Default value avoids business assumptions (no "酒店"). Editable via admin API and interview-style chat UI.
- **Memory injection**: `buildContextPrompt()` in record-service.ts injects soul + agents + channel-memory (纠错记录/禁忌) + experience (规则) into every LLM analysis call. New memory/experience services must add their output here.
- **Diff detection loop**: User edits preview via H5 → PUT handler compares analysis items against new content → `detectDiffs()` → `recordDiffCandidate()` → count≥2 auto-writes to channel-memory.md → injected into future LLM prompts.
- **Experience learning loop**: User edits preview → `analyzeEditIntent()` uses LLM to infer intent → `addEntry()` to experience.json → `buildExperiencePrompt()` injected into future LLM prompts.
- **Model routing**: Use `getForTask('analyze')` for analysis tasks, `getForTask('review')` for review tasks. Both fall back to `getDefault()`.
- **Preview markers**: `<!-- msg:ID -->` in preview.md are the primary linking mechanism. `preview-items.json` is the parallel structured tracker. When user edits remove markers, `updatePreview()` reconciles items.json by scanning remaining markers.
- **Handover confirmation**: Both `requireAccept` modes save as pending. Mode A (requireAccept=true) requires a different person to accept. Mode B (requireAccept=false) allows the sender to self-confirm. No auto-archive.
- **Message retraction**: Feishu `im.message.recalled_v1` events are handled by appending a `type: 'recalled'` tombstone to `raw.jsonl`, marking the analysis item as recalled, and removing the item from `preview.md`.
- **raw.jsonl preservation**: On handover archival, `raw.jsonl` is NOT cleared. A `type: 'handover_boundary'` record is written. `completenessCheck` only counts records after the last boundary, excluding recalled tombstones.
- **SSE for H5**: `h5-api.ts` exports `notifyDraftUpdate(channelCode)` which pushes events via EventEmitter. H5 frontend uses EventSource with polling fallback. Notifications triggered by: LLM analysis completion, preview edit, shift assignment, message retraction.
- **Tests**: vitest with `globals: true`, `environment: 'node'`. Test files in `test/`. Each test sets `DATA_DIR` to a temp dir and cleans up in `afterEach`

## License

All rights reserved. Not open source.