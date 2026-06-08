# AI 编码规则 — AI_RULES.md

> **目的**：为 AI 协作者（Claude Code 等）提供明确的编码风格、禁止模式和优先模式。每条规则背后有可执行规范（ESLint 规则或文件命名约定）。

---

## 一、语言与输出规范

1. **所有用户面向字符串必须使用中文**（日志、错误消息、API 返回、命令关键字）
2. **注释和文档使用中文**（commit message 除外，按项目习惯）
3. **代码变量名保持英文**（TypeScript/JavaScript 标准）

---

## 二、文件名约定（强制）

| 后缀 | 语义 | 禁止事项 |
|------|------|---------|
| `*-service.ts` | 纯逻辑服务，无 HTTP/Express 依赖 | 禁止 import express |
| `*-api.ts` | Express HTTP 路由/处理器 | 禁止直接操作文件系统（通过 service） |
| `*-provider.ts` | LLM Provider 实现 | 必须继承 `BaseLLMProvider` |
| `*-adapter.ts` | 渠道适配器实现 | 必须实现 `ChannelAdapter` 接口 |
| `*-client.ts` | 低级 API 客户端 | 禁止引入第三方 HTTP 库 |
| `*-middleware.ts` | Express 中间件 | 禁止业务逻辑（纯横切关注点） |
| `*-utils.ts` / `utils/*.ts` | 纯工具函数（无状态） | 禁止 import services/ |
| `*-events.ts` | 事件总线/发布订阅（无 Express） | 如 `draft-events.ts` |

**命名示例**（符合约定）：
- `card-callback-service.ts` → `src/services/` 下的纯逻辑服务（处理卡片动作回调），命名正确
- `reaction-service.ts` → `src/services/` 下的纯逻辑服务（添加表情反应），命名正确
- `h5-auth.ts` → 含路由逻辑，建议重命名为 `h5-auth-api.ts`（低优先级，非必须）

---

## 三、禁止模式（Forbidden Patterns）

### F1: 禁止直接 `process.env.DATA_DIR`

**为什么**：测试隔离需要。`getDataDir()` 在测试环境中可 mock。

```typescript
// ❌ 禁止
const dataDir = process.env.DATA_DIR || './data';

// ✅ 正确
import { getDataDir } from './utils/data-dir';
const dataDir = getDataDir();
```

**例外**：`src/index.ts` 入口文件在 CLI 参数解析阶段允许读取 `process.env.DATA_DIR`（初始化前 `getDataDir` 尚未生效）。

**可执行规范**：ESLint 规则 `no-raw-env`（`eslint-rules/no-raw-env.js`）

### F2: 禁止 `services/` 目录文件 import `web/`

**为什么**：单向依赖约束。service 层通知 web 层应通过 callback 注册。

```typescript
// ❌ 禁止（在 services/*.ts 中）
import { notifyDraftUpdate } from '../web/h5-api';

// ✅ 正确（在 app.ts 中注册）
import { setDraftUpdateNotifier } from './services/record-service';
setDraftUpdateNotifier(notifyDraftUpdate);
```

**可执行规范**：ESLint 规则 `no-service-import-web`（`eslint-rules/no-service-import-web.js`）

### F3: 禁止第三方 HTTP 客户端

**为什么**：项目约定使用原生 `http`/`https` 模块。

```typescript
// ❌ 禁止
import axios from 'axios';

// ✅ 正确（见 base-provider.ts / feishu-client.ts）
import https from 'https';
```

### F4: 禁止直接读写 `data/config/*.json`

**为什么**：必须通过 `ConfigService` 原子写入，防止并发损坏。

```typescript
// ❌ 禁止
fs.writeFileSync('data/config/channels.json', JSON.stringify(config));

// ✅ 正确
import { ConfigService } from './services/config-service';
await configService.saveChannelsConfig(config);
```

---

## 四、优先模式（Preferred Patterns）

### P1: callback 注册替代直接 import

当 service 层需要通知 web 层时：

```typescript
// services/record-service.ts
let draftUpdateNotifier: ((code: string) => void) | null = null;

export function setDraftUpdateNotifier(fn: (code: string) => void): void {
  draftUpdateNotifier = fn;
}

export function notifyDraftUpdate(code: string): void {
  if (draftUpdateNotifier) draftUpdateNotifier(code);
}
```

```typescript
// app.ts（初始化时注册）
import { setDraftUpdateNotifier } from './services/record-service';
import { notifyDraftUpdate } from './web/h5-api';
setDraftUpdateNotifier(notifyDraftUpdate);
```

### P2: 原子写入

所有配置文件写入必须使用原子方式：

```typescript
import { writeFileSync, renameSync } from 'fs';
import { join } from 'path';

function atomicWriteFile(filePath: string, data: string): void {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  writeFileSync(tmpPath, data, { encoding: 'utf-8' });
  renameSync(tmpPath, filePath);
}
```

### P3: channelCode 校验

所有接收 channelCode 的参数必须校验：

```typescript
const CHANNEL_CODE_REGEX = /^[a-zA-Z0-9_]{1,50}$/;

if (!CHANNEL_CODE_REGEX.test(channelCode)) {
  return res.status(400).json({ error: 'Invalid channel code' });
}
```

### P4: 错误信息脱敏

Admin API 错误不泄露堆栈：

```typescript
import { sanitizeError } from './web/sanitize-error';

// 在 admin API 路由中
try {
  // ...
} catch (err) {
  logger.error(`Admin API error: ${err}`); // 服务端记录完整信息
  res.status(500).json({ error: sanitizeError(err) }); // 客户端返回通用信息
}
```

---

## 五、测试规范

1. **每个测试文件设置独立的 `DATA_DIR`**（避免测试间污染）
2. **在 `afterEach` 中清理临时目录**
3. **测试直接设置 `process.env.DATA_DIR` 是允许的**（这是测试隔离机制的一部分）
4. **公共函数需要测试覆盖**，纯内部辅助函数可免测

---

## 六、注释规范

1. **默认不写注释**——代码本身应自解释
2. **以下情况必须写注释**（说明"为什么"，不是"做什么"）：
   - 隐藏约束（如飞书签名用 SHA256 而非 HMAC）
   - 微妙的不变量（如 `raw.jsonl` 追加写入永不删除）
   - 特定 bug 的 workaround
   - 与直觉相反的设计决策

---

## 七、Commit 规范

格式：`type(scope): description`

| type | 含义 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(h5): 新增班次归属 API` |
| `fix` | 修复 | `fix(channel-memory): candidates TTL 未生效` |
| `docs` | 文档 | `docs(PARADIGM): 补充 Agent 子系统说明` |
| `refactor` | 重构（无行为变更） | `refactor(eslint): 提取公共规则函数` |
| `test` | 测试 | `test(encryption): 补全边界用例` |
| `chore` | 构建/工具 | `chore(package): bump typescript` |

---

## 八、文档更新触发矩阵

| 变更类型 | 必须更新 | 验证方式 |
|---------|---------|---------|
| 新增模块 | `PARADIGM.md` 模块边界表 | 审查 checklist |
| 新增 API | `CONTEXT.json`（自动生成） | CI 同步检查 |
| 修改接口签名 | `CONTEXT.json`（自动生成） | CI 同步检查 |
| 新全局约定 | `AI_RULES.md` + ESLint 规则 | lint 通过 |
| 架构变更 | `PARADIGM.md` + `DECISIONS/` ADR | 设计审查 |
