# 项目范式文档与研发流程设计 — All Your Handover

> **日期**：2026-06-08  
> **版本**：v1.0  
> **状态**：已批准  
> **受众**：AI 协作者（Claude Code 等）+ 未来接手项目的核心开发者

---

## 一、设计目标

1. **AI 优先**：文档系统优先服务 AI 协作者，让 AI 在最短路径内建立正确的心智模型，细节从代码自动生成。
2. **渐进式披露**：从"5 秒理解项目"到"理解单个函数"，分 6 层递进，每层只加载该层需要的信息。
3. **可自维护**：下层文档（API 索引、类型字典、模块依赖）从代码自动生成；上层文档（范式、决策）通过规范化流程人工维护。
4. **重绑定**：文档尽量从代码生成，人工只写"范式层"和"决策层"，编码约定通过 ESLint 自定义规则自动校验。

---

## 二、文档架构蓝图

### 2.1 文件树

```
all-your-handover/
├── CLAUDE.md                ← 重构：AI 第一入口（命令+约定+轻量架构）
├── PARADIGM.md              ← 新增：架构哲学、数据流图、模块职责边界
├── README.md                ← 保留（用户面向）
├── CHANGELOG.md             ← 保留（版本语义化）
├── CONTEXT.json             ← 新增：机器可读项目元数据（脚本生成，根目录）
├── docs/
│   ├── all-your-handover.md ← 保留（产品 v2.1 设计）
│   ├── DECISIONS/           ← 新增：ADR 目录，模板化
│   │   ├── 001-data-storage.md
│   │   ├── 002-agent-memory-loop.md
│   │   └── NNN-*.md
│   ├── SPECS/               ← 功能 Spec 归档（由 writing-plans 产出）
│   │   └── 2026-06-08-xxx-design.md
│   └── AI_RULES.md          ← 新增：AI 编码规则（风格/禁止/优先模式）
└── scripts/
    └── update-context.js    ← CONTEXT.json 生成脚本
```

### 2.2 六层渐进披露

| 层 | 文件 | 维护 | 读取者 | 内容 |
|--|------|------|--------|------|
| L1 入口 | `README.md` | 人工 | 人类用户 | 安装、功能、快速开始 |
| L2 范式 | `CLAUDE.md` + `PARADIGM.md` | 人工 | AI 协作者 | 命令、约定、数据流、模块边界 |
| L3 决策 | `docs/DECISIONS/` | 人工（模板） | AI 协作者 | 每个重大架构决策的"为什么" |
| L4 规则 | `docs/AI_RULES.md` | 人工 | AI 协作者 | 编码风格、禁止模式、优先模式 |
| L5 上下文 | `CONTEXT.json` | **生成** | AI 协作者 | API 端点索引、类型字典、模块依赖、约定检查点 |
| L6 代码 | `src/` | 代码 | 两者 | 类型和文件名即文档 |

### 2.3 文件职责切分

- **`CLAUDE.md`**（重构后）：保留"命令、环境变量、关键约定"等 AI 执行层信息，控制在一屏内（<150 行）。保留现有内容中的"Commands""Architecture""Conventions"等快速参考信息。
- **`PARADIGM.md`**（新增）：承接现有 `CLAUDE.md` 中的详细架构描述（数据流图、模块关系、设计原则），成为 AI 理解"为什么这样设计"的核心文件。
- **`docs/AI_RULES.md`**（新增）：从 `CLAUDE.md` 中抽离的编码约束（如"禁止直接 process.env"→"使用 getDataDir()"），每条规则背后应有可执行规范支撑。
- **`CONTEXT.json`**（生成）：AI 做具体编码任务时的"索引"，包含端点列表、类型签名、依赖方向，替代 AI 遍历全部源文件。

---

## 三、可执行规范设计

### 3.1 文件名约定（规范化）

| 模式 | 语义 | 示例 |
|------|------|------|
| `*-service.ts` | 纯逻辑服务，无 HTTP 依赖 | `record-service.ts`, `handover-service.ts` |
| `*-api.ts` | Express HTTP 路由/处理器 | `h5-api.ts`, `admin-channels.ts` |
| `*-provider.ts` | LLM Provider 实现 | `deepseek-provider.ts` |
| `*-adapter.ts` | 渠道适配器实现 | `feishu-adapter.ts` |
| `*-client.ts` | 低级 API 客户端 | `feishu-client.ts` |
| `*-utils.ts` / `*.ts` 在 `utils/` | 纯工具函数（无状态） | `data-dir.ts` |
| `*-middleware.ts` | Express 中间件 | `admin-auth.ts`, `rate-limit.ts` |

**已验证的现有文件**（命名正确）：
- `card-callback-service.ts`（`src/services/`）：纯逻辑服务（处理卡片动作），命名符合 `*-service.ts` 约定。
- `reaction-service.ts`（`src/services/`）：纯逻辑服务（添加表情反应），命名符合 `*-service.ts` 约定。

**可选规范化**（低优先级）：
- `h5-auth.ts`（`src/web/`）：含路由逻辑，可考虑重命名为 `h5-auth-api.ts`。
- `h5-session-auth.ts`（`src/web/`）：中间件逻辑，可考虑重命名为 `h5-session-auth-middleware.ts`。

### 3.2 ESLint 自定义规则（新增）

新增 `eslint-rules/` 目录，用 ESLint RuleTester 编写规则本体，在 `package.json` 的 `lint` 脚本中启用。

| 规则名 | 检查内容 | 严重程度 |
|--------|---------|---------|
| `no-raw-env` | 禁止直接 `process.env.DATA_DIR`，必须使用 `getDataDir()` | error |
| `no-raw-config` | 禁止直接读写 `data/config/*.json`（必须通过 ConfigService） | warn |
| `channel-code-regex` | 所有 `channelCode` 参数必须经 `/^[a-zA-Z0-9_]{1,50}$/` 校验 | error |
| `no-bidirectional-deps` | `services/` 目录文件禁止 `import` `web/` 中的模块（单向依赖约束） | error |
| `no-service-circular` | `services/` 目录内禁止循环依赖（需提取到 `utils/`） | warn |

### 3.3 目录依赖方向（单向约束）

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

---

## 四、CONTEXT.json 生成机制

### 4.1 Schema 设计

```json
{
  "meta": {
    "version": "string",
    "techStack": ["string"],
    "entryFiles": ["string"],
    "scripts": {},
    "generatedAt": "ISO8601",
    "sourceHash": "sha256"
  },
  "endpoints": {
    "web": [{ "method", "path", "file", "line", "auth" }],
    "admin": [{ "method", "path", "file", "line", "auth" }],
    "webhook": [{ "method", "path", "file", "line", "auth" }]
  },
  "types": {
    "TypeName": { "file", "line", "fields": ["string"] }
  },
  "modules": {
    "services": { "files", "exports", "consumers" },
    "web": { "files", "exports", "providers" }
  },
  "conventions": {
    "violations": [{ "rule", "file", "line", "severity", "message" }],
    "coverage": {}
  },
  "wiring": {
    "autoCommitCallbacks": [{ "service", "register", "consumer" }],
    "eventBus": [{ "source", "event", "listeners" }]
  }
}
```

### 4.2 实现方式

**工具**：直接用项目已有的 `typescript` 包（compiler API），不引入新依赖。

**算法**：
1. `ts.createProgram` 加载所有 `.ts` 文件
2. `forEachChild` 遍历 AST：
   - 识别 `app.get/post/put/delete()` → 提取 endpoints
   - 识别 `export interface` → 提取 types
   - 识别 `import` 语句 → 构建依赖图
   - 识别 `process.env` 访问 → 记录 `no-raw-env` 违规
3. `JSON.stringify` 输出到 `CONTEXT.json`

**脚本位置**：`scripts/update-context.js`，Node.js 直接运行。

### 4.3 触发方式

| 触发方式 | 命令/事件 | 说明 |
|---------|----------|------|
| 手动 | `npm run docs:update` | 在 `package.json` scripts 中注册 |
| 可选钩子 | pre-commit | `src/` 哈希变化则自动更新；**推荐在 CI 中强制校验同步性**，不依赖本地钩子 |
| CI 校验 | PR 检查 | `CONTEXT.json` 与当前代码同步性检查 |

---

## 五、研发流程设计

### 5.1 文档更新触发矩阵

| 场景 | 需要更新的文档 | 触发者 | 验证方式 |
|------|-------------|--------|---------|
| 新增模块/服务 | `PARADIGM.md`（数据流图）、`DECISIONS/`（如需新架构决策） | 开发者 | 审查 checklist |
| 新增 API 端点 | `CONTEXT.json`（自动生成） | 脚本 | CI 同步检查 |
| 修改接口签名 | `CONTEXT.json`（自动生成） | 脚本 | CI 同步检查 |
| 引入新的全局约定 | `docs/AI_RULES.md` + 对应 ESLint 规则 | 开发者 | lint 通过 |
| 引入新的编码风格 | `docs/AI_RULES.md` | 开发者 | 审查 checklist |
| 重大架构变更 | `PARADIGM.md` + `DECISIONS/NNN-xxx.md` | 开发者 | 代码审查 + 设计审查 |

### 5.2 功能迭代流程（Spec-driven）

```
需求/问题 → 决策：是否涉及架构变更？
    ├─ 是 → 写 ADR → 审查 → 更新 PARADIGM.md → 进入 Spec
    └─ 否 → 直接进入 Spec
    ↓
[Spec] 写设计文档（docs/SPECS/YYYY-MM-DD-xxx-design.md）
    ↓
审查设计文档（人类审查）
    ↓
编码 → lint → 测试 → CONTEXT.json 自动更新
    ↓
PR → 代码审查 + CI（lint + test + context-sync-check）
    ↓
合并 → 更新 CHANGELOG.md → 版本号 bump
```

### 5.3 PR 审查 Checklist

```markdown
## 变更摘要

## 文档影响
- [ ] PARADIGM.md 需要更新（架构变更）
- [ ] DECISIONS/ 需要新增 ADR
- [ ] docs/AI_RULES.md 需要更新（新约定）
- [ ] CONTEXT.json 已自动更新（CI 验证）
- [ ] 无文档影响

## 可执行规范检查
- [ ] 所有新增文件符合命名约定
- [ ] 无新增 `process.env` 直接引用
- [ ] 无新增 web→services 反向依赖
- [ ] 新增接口有 TypeScript 类型定义
- [ ] 新增公共函数有 JSDoc（仅当"为什么"非明显时）

## 测试
- [ ] 新增代码有对应测试
- [ ] 所有测试通过
```

### 5.4 ADR 模板

文件名：`docs/DECISIONS/NNN-short-title.md`

```markdown
---
title: [简短标题]
date: [YYYY-MM-DD]
status: [proposed | accepted | superseded | deprecated]
context: [背景——当时面临什么问题，有哪些选项]
decision: [选择了什么]
consequences: [正面影响 + 负面影响 + 迁移路径]
---
```

### 5.5 版本号语义

- `MAJOR`：架构级变更（如引入数据库层、重写渠道适配器接口）
- `MINOR`：新功能（如新增企业微信适配、新增 PDF 导出）
- `PATCH`：修复、文档更新、安全补丁

版本号 bump 作为"完成定义"的一部分，在 `CHANGELOG.md` 中记录。

---

## 六、关键原则总结

1. **PARADIGM.md 是活文档**——架构变更时必更新，否则积累技术债务。
2. **DECISIONS/ 是时间胶囊**——记录"当时为什么"，而非"现在应该怎样"。
3. **CONTEXT.json 是派生数据**——永远从代码生成，不手写。
4. **AI_RULES.md 是可执行描述**——每条规则背后应有 ESLint 规则或文件命名约定支撑。
5. **审查 Checklist 是强制步骤**——跳过即视为"文档债务"。

---

## 附录：现有文档迁移计划

| 现有文件 | 迁移动作 | 目标文件 |
|---------|---------|---------|
| `CLAUDE.md`（当前） | 拆分 | `CLAUDE.md`（精简）+ `PARADIGM.md`（架构详细）+ `docs/AI_RULES.md`（编码约束） |
| `docs/all-your-handover.md` | 保留 | 不变（产品 v2.1 设计文档） |
| `CHANGELOG.md` | 保留 | 不变，按语义化版本更新 |
| `README.md` | 保留 | 不变，用户面向入口 |

---

## 附录：实施优先级

1. **P0**：创建 `PARADIGM.md`（从现有 `CLAUDE.md` 拆分）、`docs/AI_RULES.md`
2. **P0**：创建 `scripts/update-context.js`，生成首份 `CONTEXT.json`
3. **P0**：创建 `docs/DECISIONS/` 目录，迁移现有已确认决策（`docs/all-your-handover.md` 第 11 节）
4. **P1**：新增 ESLint 自定义规则（`eslint-rules/`）并接入 `npm run lint`
5. **P1**：规范化现有文件命名（`card-callback-service.ts` → `card-callback-api.ts` 等）
6. **P2**：CI 集成（CONTEXT.json 同步检查、lint 规则覆盖率报告）
