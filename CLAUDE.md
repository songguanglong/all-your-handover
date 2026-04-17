# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

All Your Handover is a lightweight, locally-deployed hotel shift handover tool. Group chat (Feishu first) is the primary interface; all data is stored locally as Markdown files with Git version control. No database, no employee tables, no login system.

Design document: `docs/all-your-handover.md` (v1.3, development-ready)

## Commands

```bash
npm run dev        # Dev mode with hot reload (tsx watch)
npm run build      # TypeScript compile
npm start          # Production run
npm test           # Run tests once (vitest)
npm run test:watch # Watch mode tests
npm run lint       # ESLint
npm run pkg        # Build single executable (Linux + Windows)
```

Single test file: `npx vitest run src/path/to/test.ts`

## Architecture

Four-layer design:

1. **IM Channel Layer** → Feishu (Phase 1), WeCom/DingTalk (Phase 2)
2. **Channel Adapter Layer** → `ChannelInterface` abstracts `receiveMessage`, `sendMessage`, `sendCard`, `parseCommand`, `getUserInfo`. `ChannelFactory` creates adapters from config.
3. **Core Service Layer** → RecordSvc, HandoverSvc, QuerySvc, SettingSvc
4. **LLM Service Layer** → Provider Factory (OpenAI/DeepSeek/Moonshot), two-level queue (per-channel ordering + global semaphore, default concurrency 3)

**Web Admin** serves at `/admin` (pure HTML + vanilla JS, no build tools). API at `/api/admin/*`.

**Feishu webhooks**: `POST /webhook/feishu` (events), `POST /webhook/feishu/card` (card callbacks). Events routed by `chatId` to the correct channel.

## Data Model

All storage is local files under `data/`. No database.

- `data/config/channels.json` — Platform credentials (shared `appId`/`appSecret`/`verificationToken`) + per-channel configs (`code`, `name`, `chatId`, `settings`)
- `data/config/llm-providers.json` — LLM provider configs (API keys AES-256-GCM encrypted)
- `data/channels/{code}/` — Per-channel data directory (`code` = English+digits, not Chinese names)
  - `drafts/ongoing.md` — Group-level draft (one per group, cleared after handover)
  - `drafts/pending.json` — Pending handover record (when requireAccept=true)
  - `handovers/YYYY-MM/{date}_{senderId}_{receiverId}.md` — Handover records with YAML frontmatter
  - `template.md` — Free-form Markdown template (LLM interprets structure)
- API keys encrypted with AES-256-GCM (key derived from machine identity)

## Key Design Decisions

- **Group-level draft** (not per-person): one `ongoing.md` per channel, all group members contribute
- **Chat commands**: `@自己 交班/接班/取消/草稿` — user @s themselves (not the bot) + keyword. Parsed by checking `senderId ∈ mentionList`
- **messageFilter**: `all` (process all messages) vs `mention` (only messages where bot is @mentioned). Commands are independent of this filter.
- **Two handover modes**: `requireAccept=true` (wait for receiver's `@自己 接班`) vs `requireAccept=false` (auto-archive on `@自己 交班`)
- **LLM degradation**: Raw text written to draft immediately, LLM analysis appended async; on failure, draft keeps raw text with "pending_analysis" status
- **Git auto-commit**: 30-second debounce, batched messages
- **No Web auth**: OS-level security only (localhost binding, firewall)
- **File naming**: English+digits+underscores only. Chinese names only in file content frontmatter, never in filenames
- `channel.json` in channel dir is **runtime state** only (lastMessageAt, draftMessageCount), not config — all config lives in `channels.json`

## Code Conventions

- TypeScript strict mode
- Source in `src/`, compiled to `dist/`
- Express routes: webhook routes in `src/channels/`, admin API routes in `src/web/`
- Markdown operations in `src/services/`
- Git operations through `GitManager` class (always use `autoCommit`, never direct `git commit`)