# PARADIGM.md — 架构范式

> **目的**：描述 All Your Handover 的架构哲学、数据流、模块边界和设计原则。供 AI 协作者建立心智模型。

---

## 一、架构哲学

### 核心原则

1. **数据自有**：所有数据存储在客户本地，Markdown/JSON 文件格式，Git 自动版本化
2. **零数据库**：单进程 Node.js，文件系统即数据库，降低部署门槛
3. **事件驱动而非直接依赖**：services 通知 web 层通过 callback 注册（如 `setDraftUpdateNotifier()`），而非直接 import
4. **单向依赖**：web → services → utils/types，反向禁止
5. **纯代码优先**：架构决策尽量体现在代码结构和文件名中，减少文档漂移

### 技术选型原则

- 无第三方 HTTP 客户端（原生 http/https）
- LLM Provider 必须兼容 OpenAI `/chat/completions`
- 管理后台 + H5 前端使用纯 HTML + 原生 JS（无构建工具）
- AES-256-GCM 加密敏感配置

---

## 二、数据流

### 2.1 随手记流程

```
Feishu webhook → webhook.ts → verify signature → find channel by chatId
  ├─ Command (@自己 交班) → handover-orchestrator.ts → save pending → send card with H5 link
  ├─ Message → record-service.ts → append raw + enqueue LLM task → llm-queue.ts
  │    └─ LLM analysis → update analysis.json + incrementalUpdatePreview → notifyDraftUpdate (SSE)
  └─ Message Recalled → record-service.ts → append tombstone to raw.jsonl + mark analysis recalled → notifyDraftUpdate (SSE)
```

### 2.2 H5 交互流程

```
H5 Page → h5-api.ts
  ├─ GET  /draft/:code/events   → SSE endpoint (real-time updates)
  ├─ GET  /draft/:code/status   → lightweight poll
  ├─ GET  /draft/:code          → load draft data
  ├─ PUT  /draft/:code/preview  → save user edit → diff detection → experience learning
  ├─ POST /draft/:code/assign-shift → mark item shift
  ├─ POST /handover/:code/start  → save pending
  ├─ POST /handover/:code/accept → archive or self-confirm
  └─ POST /handover/:code/reject → remove pending
```

### 2.3 记忆闭环

```
buildContextPrompt() → soul + agents + channel-memory (纠错记录/禁忌) + experience (规则)
  ↓
User edits preview → detectDiffs() → recordDiffCandidate() → count≥2 → write channel-memory.md
User edits preview → analyzeEditIntent() → addEntry() → experience.json
Post-handover → dream-service → candidate memory → channel-memory.md
```

---

## 三、模块边界

### 3.1 目录依赖方向

```
src/
├── index.ts → app.ts → server.ts
├── app.ts → 所有 service（setAutoCommit 模式）
├── services/ ← 纯逻辑层，无 Express 引用
├── web/ ← Express 路由层，可引用 services/，反向禁止
├── channels/ ← 适配器层，可引用 services/，反向禁止
├── llm/ ← Provider 层，独立
├── utils/ ← 工具层，被所有层引用
└── types/ ← 类型定义，被所有层引用
```

**通信方式**：`services/` 通知 `web/` 不通过 import，而是通过 callback 注册（如 `setDraftUpdateNotifier()`）。

### 3.2 关键模块职责

| 模块 | 文件 | 职责 | 依赖 |
|------|------|------|------|
| App | `app.ts` | 单例，持有 GitManager、LLMQueue，协调 auto-commit | services（通过 callback） |
| Record Service | `record-service.ts` | 核心消息处理器，buildContextPrompt，LLM 分析入队 | llm-queue, config, channel-memory, experience |
| Handover Orchestrator | `handover-orchestrator.ts` | 交接流程控制（两种模式，均需 H5 确认） | draft-services, handover-service |
| LLM Queue | `llm-queue.ts` | 每渠道 FIFO + 全局信号量（并发 3，2 次重试） | llm-provider-factory |
| Channel Adapter | `channels/` | 渠道抽象（飞书已实现） | feishu-client |
| H5 API | `h5-api.ts` | H5 路由，草稿/交接/班次操作 | draft-services, handover-orchestrator |
| Config Service | `config-service.ts` | 渠道、Provider、模板、系统 Prompt 管理 | encryption, atomic-write |

### 3.3 草稿存储（4 文件架构）

| 文件 | 格式 | 职责 |
|------|------|------|
| `raw.jsonl` | JSONL | 原始消息（追加写入，handover_boundary 标记分隔班次） |
| `analysis.json` | JSON | LLM 分析结果（按 msgId 更新，支持 recalled） |
| `preview.md` | Markdown | 结构化交接预览（`<!-- msg:ID -->` 标记） |
| `preview-items.json` | JSON | 并行结构化条目跟踪（用户编辑后按 marker 对账） |

---

## 四、Agent 智能子系统

### 4.1 记忆注入

每次 LLM 分析调用前，`buildContextPrompt()` 注入：
- **Soul** (`soul.md`)：人设、语气、边界
- **Agents** (`agents.md`)：行为规则（优先级判断、组织规范、禁忌）
- **Channel Memory** (`channel-memory.md`)：仅 纠错记录 + 禁忌 注入 prompt
- **Experience** (`experience.json`)：学习到的规则

### 4.2 自进化闭环

| 触发器 | 流程 | 输出 | 注入点 |
|--------|------|------|--------|
| 用户编辑 preview | detectDiffs → recordDiffCandidate → count≥2 | channel-memory.md | buildContextPrompt |
| 用户编辑 preview | analyzeEditIntent → addEntry | experience.json | buildContextPrompt |
| 交接归档后 | dream-service → 修改率 >30% → LLM 分析 | channel-memory.md (高置信度≥0.8) | buildContextPrompt |

---

## 五、安全设计

| 层面 | 措施 |
|------|------|
| 加密 | AES-256-GCM（API Key、App Secret） |
| 认证 | ADMIN_TOKEN Bearer（admin），Feishu OAuth（H5） |
| 限流 | 60 req/min per IP (/api)，SSE 50 并发上限 |
| 错误脱敏 | `sanitizeError()` 返回 generic message |
| 签名 | SHA256(timestamp + nonce + encryptKey + body)，timingSafeEqual |
| 路径防护 | channelCode regex `/^[a-zA-Z0-9_]{1,50}$/`，禁止路径遍历 |
| 原子写入 | `atomicWriteFile`（tmp → rename）防止配置损坏 |

---

## 六、扩展设计

### 6.1 新增渠道适配器

1. 实现 `ChannelAdapter` 接口（`channels/channel-factory.ts`）
2. 在 `llm-provider-factory.ts` `providerClasses` 中注册（如需新增 Provider）
3. 在 `server.ts` 中注册 webhook 路由
4. 在 `PARADIGM.md` "目录依赖方向" 中标注新渠道位置

### 6.2 新增 LLM Provider

1. 继承 `BaseLLMProvider`（`llm/base-provider.ts`）
2. 在 `llm-provider-factory.ts` `providerClasses` map 中注册
3. 无需修改其他代码

---

## 七、决策参考

| 主题 | 文件 |
|------|------|
| 为什么用文件存储而非数据库 | `docs/DECISIONS/001-data-storage.md` |
| 为什么草稿分 4 个文件 | `docs/DECISIONS/012-draft-four-files.md` |
| 为什么 H5 认证用飞书 OAuth | `docs/DECISIONS/018-h5-auth.md` |
| 所有决策 | `docs/DECISIONS/` 目录 |
