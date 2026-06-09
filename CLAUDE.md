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
npm run lint         # ESLint with custom rules (eslint-rules/)
npm run docs:update  # Regenerate CONTEXT.json
```

**CLI args:** `--port <number>` (default 3000 or PORT env), `--data <path>` (default ./data or DATA_DIR env), `uninstall` subcommand

**Env vars:** `PORT`, `DATA_DIR`, `ENCRYPTION_KEY` (for config secret encryption; auto-generates if unset), `ADMIN_TOKEN` (Bearer token for admin API; no auth if unset)

## Quick Architecture Reference

Single-process Node.js server. No database — all data is Markdown/JSON files under `DATA_DIR` with Git auto-commits (30s debounce).

See `PARADIGM.md` for full architecture, data flow, and module boundaries.

## Key Conventions (enforced by eslint-rules/)

- **All user-facing strings are in Chinese** (log messages, command keywords, card content, API errors)
- **channelCode** is regex-validated (`/^[a-zA-Z0-9_]{1,50}$/`)
- **Use `getDataDir()`** from `src/utils/data-dir.ts` — never `process.env.DATA_DIR` directly (needed for test isolation)
- **File naming**: `*-service.ts` = pure logic, `*-api.ts` = Express routes, `*-provider.ts` = LLM provider, `*-adapter.ts` = channel adapter, `*-client.ts` = low-level API client, `*-middleware.ts` = Express middleware
- **No HTTP client library** — raw `http`/`https` modules only
- **LLM providers** must be OpenAI-compatible (`/chat/completions`)
- **Admin route errors** use `sanitizeError()` helper — returns generic 'Internal error', logs details server-side
- **Auto-commit wiring**: Services export `setAutoCommit(fn)`, App calls them in `initialize()`. No direct App import from services.
- **Model routing**: Use `getForTask('analyze')` for analysis, `getForTask('review')` for review. Both fall back to `getDefault()`.

## Documentation Layers (按需读取)

```
README.md          → 用户面向（安装、功能）
PARADIGM.md        → 架构范式（详细数据流、模块边界）
docs/FLOWS.md      → 业务流程图（代码逻辑 vs 大模型处理的可视化）
docs/AI_RULES.md   → 编码规则（风格、禁止、优先模式、ESLint 规则）
docs/DECISIONS/    → 架构决策记录（ADRs）
CONTEXT.json       → 机器可读项目索引（从代码自动生成，无需手动维护）
```

**按需读取指引**（agent 根据当前任务类型选择读取）：
- **架构设计 / 新增模块** → 先读 `PARADIGM.md`，再读相关 `docs/DECISIONS/`
- **编码 / 接口修改** → 先读 `docs/AI_RULES.md`，再读 `docs/FLOWS.md` 定位业务流
- **理解业务逻辑** → 读 `docs/FLOWS.md` 定位相关流程图
- **新增 API 端点** → 编码完成后运行 `npm run docs:update` 更新 `CONTEXT.json`
- **引入新全局约定** → 更新 `docs/AI_RULES.md` + `eslint-rules/`

See `PARADIGM.md` and `docs/AI_RULES.md` for detailed conventions.

## License

All rights reserved. Not open source.
