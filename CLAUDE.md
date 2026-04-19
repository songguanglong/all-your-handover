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

**Env vars:** `PORT`, `DATA_DIR`, `ENCRYPTION_KEY` (for config secret encryption; auto-generates if unset)

## Architecture

Single-process Node.js server. No database — all data is Markdown/JSON files under `DATA_DIR` with Git auto-commits (30s debounce).

### Data Flow

```
Feishu webhook → webhook.ts → verify signature → find channel by chatId
  ├─ Command (@自己 交班/接班/取消/草稿) → handover-orchestrator.ts
  └─ Message → record-service.ts → append to draft + enqueue LLM task → llm-queue.ts → draft-service.ts updates analysis
       └─ If message replies to another → fetch quoted context via ChannelAdapter.fetchMessageContent
```

### Key Modules

- **App singleton** (`app.ts`): Holds `GitManager`, `LLMQueue`, wires auto-commit via `setAutoCommit()` into draft-service and handover-service. Retrieved globally via `getApp()`.
- **LLM Queue** (`llm-queue.ts`): Per-channel FIFO ordering, global Semaphore (default concurrency 3), 2 retries with exponential backoff.
- **Channel Adapter** (`channels/`): `ChannelAdapter` interface → `FeishuAdapter`. Factory pattern supports adding WeChat Work/DingTalk. Commands detected by Chinese keywords after stripping @-mentions: 交班→START, 接班→ACCEPT, 取消→CANCEL, 草稿→VIEW. `fetchMessageContent()` for reply context injection.
- **Context Service** (`context-service.ts`): Loads previous handover records for LLM context injection during handover generation. Pure code, no LLM calls.
- **Config Service** (`config-service.ts`): Manages channel configs, LLM providers, templates, and system prompts. `getSystemPrompt()` returns per-channel prompt or default.
- **Draft Service** (`draft-service.ts`): In-process Mutex for concurrent writes. Drafts are Markdown with YAML frontmatter, `<!-- msg:id -->` markers, and `## LLM 整理预览` section.
- **Encryption** (`encryption.ts`): AES-256-GCM. Key from `ENCRYPTION_KEY` env (SHA-256 derived) or auto-generated random key persisted to `data/config/.encryption-key` (mode 0o600).

### DATA_DIR Structure

```
data/
  config/
    channels.json          # Channel configs
    llm-providers.json     # LLM provider configs (API keys encrypted)
    .encryption-key         # Auto-generated if no ENCRYPTION_KEY env
  channels/<code>/
    drafts/ongoing.md       # Current draft (Markdown + frontmatter)
    drafts/pending.json     # Pending handover state
    handovers/YYYY-MM/*.md  # Completed handover records
    template.md             # Per-channel handover template
    system-prompt.txt       # Per-channel system prompt (configurable, defaults in code)
    media/images/, audio/   # Downloaded media
  logs/app.log
```

## Conventions

- **All user-facing strings are in Chinese** (log messages, command keywords, card content, API errors)
- **channelCode** is the organizational key — partitions data dirs, LLM queues, and is regex-validated (`/^[a-zA-Z0-9_]{1,50}$/`)
- **Use `getDataDir()`** from `src/utils/data-dir.ts` — never `process.env.DATA_DIR` directly (needed for test isolation)
- **Admin route errors** use `sanitizeError()` helper — never leak stack traces
- **Auto-commit wiring**: Services export `setAutoCommit(fn)`, App calls them in `initialize()`. No direct App import from services.
- **LLM providers** must be OpenAI-compatible (`/chat/completions`). Add new providers by subclassing `BaseLLMProvider` and registering in `llm-provider-factory.ts` `providerClasses` map
- **No HTTP client library** — raw `http`/`https` modules in `base-provider.ts` and `feishu-client.ts`
- **Fallback without LLM**: If no default provider, messages still record to drafts but analysis returns `{ category: '未分类', content: text, urgency: 'normal' }`
- **Feishu signature**: SHA256(timestamp + nonce + encryptKey + body), NOT HMAC. Uses `timingSafeEqual`
- **Handover context**: Previous handover is loaded by `context-service.ts` (code) and injected into LLM prompt. LLM decides how to reference it — no hardcoded business logic in prompts.
- **System prompt**: Configurable per-channel via `system-prompt.txt`. Default value avoids business assumptions (no "酒店"). Editable via admin API and interview-style chat UI.
- **Tests**: vitest with `globals: true`, `environment: 'node'`. Test files in `test/`. Each test sets `DATA_DIR` to a temp dir and cleans up in `afterEach`

## License

All rights reserved. Not open source.