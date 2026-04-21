# All Your Handover - 产品设计文档

> **版本**：v2.1
> **日期**：2026-04-21
> **状态**：已实现核心功能
> **项目名**：All Your Handover
> **仓库/包名**：all-your-handover

---

## 一、产品定位

### 产品愿景
**All Your Handover**：简化版的、面向交班场景的 LLM Wiki 工具

> **名字由来**：一语双关——"所有交接数据归你所有" + 致敬经典极客梗"All your base are belong to us"。体现核心理念：数据在你手里，交接由你做主。

### 核心问题
原 SaaS 版本的痛点：
- 数据在厂商手中，合规风险高
- 后台设置复杂，需要配置员工、班次、权限等
- 需要数据库，运维门槛高

### 解决方案

**All Your Handover**：轻量级本地部署的酒店交接班工具

**核心主张**：
- **数据自有**：所有数据存储在客户本地，Markdown/JSON 文件格式
- **一键部署**：下载即用，单可执行文件零依赖
- **零配置启动**：无需预设员工表、班次表，开箱即用
- **多群支持**：一个实例服务多个群（前台群、客房群等）
- **多渠道支持**：飞书/企业微信/钉钉，初版先实现飞书
- **LLM 灵活配置**：Web 后台配置 Provider，支持多种模型和按任务路由
- **Agent 智能系统**：可设定人设、积累经验、自我进化

### 目标用户
- **首要用户**：前台员工（直接使用者）
- **次要用户**：前台主管/店长（管理视角，历史查询）

---

## 二、技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           IM 渠道层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │   飞书      │  │  企业微信    │  │    钉钉     │                      │
│  │  (已实现)   │  │  (Phase 2) │  │  (Phase 2)  │                      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                      │
└─────────┼────────────────┼────────────────┼─────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        渠道适配层 (Channel Adapter)                     │
│  ChannelAdapter 接口: receiveMessage, sendMessage, sendCard,           │
│  parseCommand, getUserInfo, getChatMembers, fetchMessageContent,      │
│  addReaction (可选)                                                     │
│  ┌─────────────┐                                                       │
│  │FeishuAdapter│  (Webhook + JS-SDK OAuth)                             │
│  └─────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          核心服务层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  随手记服务  │  │  交接服务   │  │  查询服务   │  │  设置服务   │   │
│  │  RecordSvc  │  │ HandoverSvc │  │  QuerySvc   │  │ SettingSvc  │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Agent 智能系统层                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  灵魂    │  │ 行为规则  │  │  经验    │  │ 渠道记忆 │              │
│  │  Soul    │  │  Agents  │  │Experience│  │  Memory  │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
│  ┌──────────┐  ┌──────────┐                                            │
│  │ Diff检测 │  │  梦境反思 │                                            │
│  │  Diff    │  │  Dream   │                                            │
│  └──────────┘  └──────────┘                                            │
│                                                                         │
│  记忆闭环: buildContextPrompt() → soul+agents+memory+experience       │
│  自进化: 用户编辑 → diff检测 → 记忆候选 → 重复≥2次 → 写入记忆         │
│  自进化: 用户编辑 → analyzeEditIntent() → 经验规则 → 注入prompt      │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          LLM 服务层                                      │
│  LLM Provider Factory (支持按任务路由: analyze / review)               │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐                                │
│  │ OpenAI  │  │ DeepSeek │  │ Moonshot │                                │
│  └─────────┘  └──────────┘  └─────────┘                                │
│                                                                         │
│  能力: analyzeText, analyzeImage, transcribeAudio,                      │
│       generateHandover, chatCompletion                                   │
│  参数: soulPrompt (灵魂+记忆+经验), thinkingMode (quick/standard/deep) │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          数据存储层                                      │
│  Markdown/JSON 文件存储（Git 自动提交，30s 防抖）                       │
│  data/config/  → channels.json, llm-providers.json                     │
│  data/channels/{code}/ → drafts/, handovers/, media/, dreaming/         │
│  AES-256-GCM 加密: API Key, App Secret 等敏感配置                        │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Web 管理后台 + H5 移动端                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐│
│  │ LLM 设置  │ │ 渠道设置  │ │ 模版设置  │ │ Agent设置 │ │ 历史查询 ││
│  │ + 模型路由│ │ + H5 Auth │ │ + 访谈式  │ │ 灵魂/经验 │ │ 交接记录 ││
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └──────────┘│
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  H5 移动端（飞书侧边栏）: 草稿查看/编辑/交班/接班/打回          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 后端框架 | **TypeScript + Node.js + Express** | 单进程，无数据库 |
| 渠道 SDK | 飞书 SDK (自实现) | 纯 http/https，无第三方 SDK 依赖 |
| LLM | 多 Provider + 模型路由 | OpenAI / DeepSeek / Moonshot |
| 数据存储 | Markdown + JSON 文件 | 主存储，轻量无依赖 |
| 版本控制 | Git（自动提交，30s 防抖） | 所有变更可追溯 |
| 前端 | **纯 HTML + 原生 JS** | 管理后台 + H5 页面，无构建工具 |
| 加密 | AES-256-GCM | API Key、App Secret 等敏感配置 |
| 部署 | **单可执行文件 / Docker** | 两种方式，零依赖安装 |

---

## 三、核心流程

### 3.1 随手记流程

```
员工在群聊发消息（文本/图片/语音）
        ↓
程序接收消息，检查群级别配置（messageFilter）
        ↓
  ├─ all：处理所有消息 → 继续
  └─ mention：仅处理包含 @机器人 的消息 → 过滤
        ↓
如果消息回复了另一条消息 → 获取被引用消息内容作为上下文
        ↓
追加到 raw.jsonl + 构建 context prompt (soul+agents+memory+experience)
        ↓
LLM 分析 → 返回 {category, content, urgency}
        ↓
更新 analysis.json + incrementalUpdatePreview (preview.md + preview-items.json)
        ↓
添加 ✅ 表情确认
```

**特点**：
- 草稿是群级别的，不是个人的——一个群一个草稿
- 群内任何人发的消息都会追加到同一草稿
- 支持文本、图片、语音多模态
- LLM 每条消息实时调用，立即整理分类
- 消息过滤模式可按群配置（Web 后台设置）
- **LLM prompt 注入**：soul（人设）+ agents（行为规则）+ channel-memory（纠错记录/禁忌）+ experience（经验规则）

### 3.2 草稿查看与编辑（H5 页面）

**方案**：飞书消息卡片内嵌 H5 侧边栏链接，点击打开移动端页面

```
员工点击消息卡片中的 H5 链接
        ↓
打开 H5 页面（飞书侧边栏或独立页面）
        ↓
  ├─ 飞书 OAuth 认证 → 获取用户身份（open_id, name）
  └─ 无认证 → 使用匿名身份（h5_user）
        ↓
加载草稿数据（raw count, analysis items, preview.md）
        ↓
  ├─ 查看模式：渲染 Markdown 预览
  └─ 编辑模式：textarea 编辑 preview.md 内容
        ↓
保存编辑 → PUT /draft/:code/preview
        ↓
  ├─ 更新 preview.md + preview-items.json（按 marker 对账）
  ├─ diff 检测 → 比较 analysis items vs 新内容 → recordDiffCandidate()
  └─ 经验学习 → analyzeEditIntent() → addEntry() → experience.json
```

**数据模型**：草稿拆分为 4 个文件

| 文件 | 格式 | 用途 |
|------|------|------|
| `raw.jsonl` | JSONL | 原始消息记录（追加写入） |
| `analysis.json` | JSON | LLM 分析结果（按 msgId 更新） |
| `preview.md` | Markdown | 结构化交接预览（含 `<!-- msg:ID -->` 标记） |
| `preview-items.json` | JSON | 并行结构化条目跟踪（用户编辑后按 marker 对账） |

### 3.3 交接流程

**核心理念：所有模式都必须通过 H5 确认后才能归档**

**模式 A：需要接班确认（requireAccept = true）**

```
交班人在群聊发送：@自己 交班
        ↓
程序收到交班指令 → 读取 preview.md → 完整性检查
        ↓
保存 pending.json（快照交班内容和交班人）
        ↓
向群聊发送交接消息卡片（含 H5 链接）
        ↓
接班人通过 H5 页面点击"确认接班"
        ↓
handleHandoverAccept → 归档交接记录 → 清空草稿
        ↓
向群聊推送"交接完成"确认消息卡片
```

**模式 B：不需要接班确认（requireAccept = false）**

```
交班人在群聊发送：@自己 交班
        ↓
程序收到交班指令 → 读取 preview.md → 完整性检查
        ↓
保存 pending.json（快照交班内容和交班人）
        ↓
向群聊发送交接消息卡片（含 H5 链接）
        ↓
交班人通过 H5 页面自行确认
        ↓
handleHandoverAccept → 校验确认人 = 交班人 → 归档 → 清空草稿
```

**打回流程**（两种模式通用）：

```
H5 页面点击"打回"
        ↓
removePending → 删除 pending.json
        ↓
通知群聊"交班已被打回，交班人可重新编辑后再发起交班"
```

**特点**：
- 两种模式都不自动归档，必须经过 H5 确认
- 模式 A 只允许非交班人确认（接班的）
- 模式 B 只允许交班人自行确认
- 同一群同一时间只允许一份待交接

### 3.4 历史查询

**员工**：翻群里的消息卡片即可，无需登录任何系统

**管理员**：访问 Web 后台页面查询（分页、日期范围、关键词过滤）

---

## 四、数据模型

### 4.1 配置文件结构

```
data/
├── config/
│   ├── llm-providers.json    # LLM Provider 配置 + 模型路由（API Key 加密）
│   ├── channels.json          # 渠道配置 + 平台配置（密钥加密）
│   └── .encryption-key        # AES-256 加密密钥（自动生成）
├── channels/                  # 按渠道 code 组织数据
│   └── qiantai/               # code: "qiantai"
│       ├── template.md         # 交接模版
│       ├── system-prompt.txt   # 系统提示词
│       ├── soul.md             # 灵魂人设定义
│       ├── agents.md           # 行为规则
│       ├── experience.json     # 经验规则
│       ├── channel-memory.md   # 渠道记忆
│       ├── drafts/
│       │   ├── raw.jsonl       # 原始消息记录
│       │   ├── analysis.json   # LLM 分析结果
│       │   ├── preview.md      # 交接预览
│       │   ├── preview-items.json  # 结构化条目跟踪
│       │   └── pending.json   # 待交接记录
│       ├── handovers/2026-04/ # 交接记录
│       ├── dreaming/
│       │   ├── candidates.json # 记忆候选
│       │   └── reviews/        # 梦境反思记录
│       └── media/
│           ├── images/
│           └── audio/
├── logs/app.log
└── .git/
```

### 4.2 LLM Provider 配置（config/llm-providers.json）

```json
{
  "providers": [
    {
      "id": "deepseek-1",
      "name": "DeepSeek",
      "type": "deepseek",
      "apiKey": "sk-xxx（加密存储）",
      "baseUrl": "https://api.deepseek.com",
      "model": "deepseek-chat",
      "isDefault": true,
      "isEnabled": true,
      "createdAt": "2026-04-01T10:00:00Z",
      "updatedAt": "2026-04-01T10:00:00Z"
    }
  ],
  "defaultProviderId": "deepseek-1",
  "routes": {
    "analyze": { "providerId": "openai-1" },
    "review": { "providerId": "deepseek-1" }
  }
}
```

**模型路由**：`routes` 可为 `analyze`（消息分析）和 `review`（交接生成）指定不同的 Provider。未配置时回退到 `defaultProviderId`。

### 4.3 渠道配置（config/channels.json）

与 v1.8 相同，参见原文档。`settings.requireAccept` 语义已变更：
- `true`：需非交班人通过 H5 确认
- `false`：交班人通过 H5 自行确认（**不再自动归档**）

### 4.4 交接模版（channels/{code}/template.md）

与 v1.8 相同，使用 `{{placeholder}}` 占位符模版。

### 4.5 交接记录（channels/{code}/handovers/）

与 v1.8 相同，YAML frontmatter + Markdown 格式。`requireAccept=false` 时 receiver 仍为空。

### 4.6 交接草稿（channels/{code}/drafts/）

草稿拆分为 4 个文件：

**raw.jsonl** — 原始消息记录（追加写入）
```jsonl
{"id":"msg_xxx","ts":"2026-04-01T14:30:00Z","sender":"ou_xxx","sender_name":"张三","type":"text","content":"302客人要加床","quoted_context":null}
{"id":"msg_yyy","ts":"2026-04-01T15:00:00Z","sender":"ou_xxx","sender_name":"张三","type":"image","content":"[图片: /data/channels/qiantai/media/images/msg_yyy.jpg]","quoted_context":null}
```

**analysis.json** — LLM 分析结果
```json
{
  "lastUpdated": "2026-04-01T15:00:00Z",
  "messageCount": 2,
  "items": [
    { "msgId": "msg_xxx", "category": "待办事项", "content": "302客人需要加床", "urgency": "high" },
    { "msgId": "msg_yyy", "category": "客户", "content": "VIP客人信息", "urgency": "normal" }
  ]
}
```

**preview.md** — 结构化交接预览
```markdown
# 交接班记录

## 待办事项

- 302客人需要加床 (紧急) <!-- msg:msg_xxx -->

## 客户

- VIP客人信息 (一般) <!-- msg:msg_yyy -->
```

**preview-items.json** — 并行条目跟踪
```json
{
  "items": [
    { "msgId": "msg_xxx", "category": "待办事项", "content": "302客人需要加床", "urgency": "high" },
    { "msgId": "msg_yyy", "category": "客户", "content": "VIP客人信息", "urgency": "normal" }
  ]
}
```

### 4.7 待交接记录（channels/{code}/drafts/pending.json）

与 v1.8 相同。两种模式都会暂存 pending.json。

### 4.8 Agent 智能数据

**soul.md** — 灵魂人设（Markdown 格式，定义 Agent 的人格、语气、边界）
```markdown
# 交班助手人格

## 我是谁
交班助手。记录、整理、交接。不是管理者，不是决策者。

## 我怎么说话
- 准确 > 华丽
- 该紧急就紧急，该平淡就平淡

## 我的边界
- 只处理与本班交接相关的内容
- 不对人员做评价
```

**agents.md** — 行为规则（默认：优先级判断、组织规范、禁忌）

**experience.json** — 经验规则
```json
{
  "entries": [
    {
      "id": "exp_xxx",
      "createdAt": "2026-04-01T16:00:00Z",
      "source": "edit",
      "rule": "紧急事项应按时间顺序排列",
      "context": "用户编辑了 LLM 生成的交接记录"
    }
  ],
  "lastDreamAt": null
}
```

**channel-memory.md** — 渠道记忆
```markdown
# 渠道记忆

## 用户偏好

## 模式识别

## 纠错记录

- 2026-04-01：high优先级应标"紧急"，之前标"紧急"已纠正

## 禁忌
```

---

## 五、渠道适配层设计

### 5.1 渠道接口抽象

```typescript
interface ChannelAdapter {
  readonly type: string;   // 'feishu' | 'wecom' | 'dingtalk'
  readonly code: string;   // 渠道标识
  readonly name: string;   // 显示名称

  initialize(config: { platform: PlatformConfig; chatId: string }): Promise<void>;
  receiveMessage(event: unknown): Promise<Message | null>;
  sendMessage(chatId: string, message: MessageContent): Promise<void>;
  sendCard(chatId: string, card: CardContent): Promise<string>;
  parseCommand(message: Message): Command | null;
  getUserInfo(userId: string): Promise<UserInfo>;
  getChatMembers(chatId: string): Promise<UserInfo[]>;
  fetchMessageContent(messageId: string): Promise<string | null>;
  addReaction?(messageId: string, emoji: string): Promise<void>;
}

type CommandType = 'HANDOVER_START';
// 接班/打回操作通过 H5 页面完成，不再作为群聊指令
```

### 5.2 飞书适配器（已实现）

- FeishuClient：低级 API 客户端（tenant token 自动刷新、消息发送、图片/音频下载、表情回复）
- FeishuAdapter：实现 ChannelAdapter 接口
  - 消息接收：解析 text/image/audio 多模态消息
  - 指令识别：仅 `交班` → HANDOVER_START
  - 用户信息缓存：Map 缓存减少 API 调用
- FeishuSignature：SHA256(timestamp + nonce + encryptKey + body) 验签，5分钟防重放
- FeishuCardBuilder：消息卡片构建（交接卡片含 H5 链接、完成确认卡片）

### 5.3 渠道工厂

单例模式，管理渠道适配器实例。支持 `get(code)`、`list()`、`reload()`。

### 5.4 H5 移动端 API

**认证**：
```
GET /api/h5/auth/feishu?code=xxx   飞书 JS-SDK OAuth（auth_code 换用户信息）
```

**草稿**：
```
GET /api/h5/draft/:code            获取草稿数据（preview + raw count + analysis items + lastUpdated）
PUT /api/h5/draft/:code/preview    保存预览编辑（触发 diff 检测 + 经验学习）
POST /api/h5/draft/:code/assign-shift  归属班次（纳入交接/归入下一班）
```

**交接**：
```
GET /api/h5/handover/:code/pending  查询待交接状态
POST /api/h5/handover/:code/start  发起交班
POST /api/h5/handover/:code/accept 确认接班
POST /api/h5/handover/:code/reject 打回交接
```

**PUT preview 触发的自进化流程**：
1. 读取旧 preview + analysis items
2. 更新 preview.md + 对账 preview-items.json（按 `<!-- msg:ID -->` 标记）
3. diff 检测：对比 analysis items vs 新内容 → `recordDiffCandidate()`
4. 经验学习：旧内容 ≠ 新内容 → `analyzeEditIntent()` → `addEntry()`

### 5.5 支持的渠道优先级

| 渠道 | 状态 | 说明 |
|------|------|------|
| 飞书 | 已实现 | 消息卡片 + H5 侧边栏 |
| 企业微信 | Phase 2 | 群聊交互类似 |
| 钉钉 | Phase 2 | 群聊交互类似 |

---

## 六、LLM Provider 设计

### 6.1 Provider 接口

```typescript
interface LLMProvider {
  readonly id: string;
  readonly type: string;
  readonly name: string;

  initialize(config: LLMProviderConfig): Promise<void>;
  analyzeText(params: AnalyzeTextParams & { soulPrompt?: string }): Promise<AnalyzeResult>;
  analyzeImage(params: AnalyzeImageParams & { soulPrompt?: string }): Promise<AnalyzeResult>;
  transcribeAudio(params: TranscribeParams & { soulPrompt?: string }): Promise<string>;
  generateHandover(params: GenerateHandoverParams): Promise<string>;
  chatCompletion(messages: Array<{role, content}>, thinkingMode?: ThinkingMode): Promise<string>;
}

interface GenerateHandoverParams {
  draft: string;
  template: string;
  previousHandover?: { id: string; date: string; body: string };
  systemPrompt?: string;
  soulPrompt?: string;        // 灵魂 + 记忆 + 经验
  experiencePrompt?: string;  // 已合并入 soulPrompt，保留兼容
}

type ThinkingMode = 'quick' | 'standard' | 'deep';
// quick: 低温度(0.3), 512 tokens — 用于消息分析
// standard: 中温度(0.7), 无限制 — 默认
// deep: 高温度(0.8), 4096 tokens — 用于复盘
```

### 6.2 Provider 工厂 + 模型路由

```typescript
class LLMProviderFactory {
  getDefault(): LLMProvider | null;
  get(id: string): LLMProvider | null;
  getForTask(task: 'analyze' | 'review'): LLMProvider | null;
  // getForTask 先查 routes[task].providerId，找不到回退 getDefault()
  list(): LLMProviderInfo[];
  reload(): Promise<void>;
}
```

### 6.3 支持的 Provider

| Provider | 状态 | 特点 |
|----------|------|------|
| OpenAI | 已实现 | GPT-4 多模态支持（图片+语音） |
| DeepSeek | 已实现 | 国内访问稳定，性价比高 |
| Moonshot | 已实现 | 长文本支持，图片识别 |

### 6.4 Admin API

**Provider 管理**：
```
GET    /api/admin/llm-providers          列出（API Key 掩码）
POST   /api/admin/llm-providers          添加
PUT    /api/admin/llm-providers/:id       更新
DELETE /api/admin/llm-providers/:id       删除
PUT    /api/admin/llm-providers/:id/default  设为默认
PUT    /api/admin/llm-providers/:id/toggle  启用/禁用
```

**平台配置**：
```
GET    /api/admin/platforms/:type          获取（密钥掩码）
PUT    /api/admin/platforms/:type          更新
POST   /api/admin/platforms/:type/test     测试连接
```

**渠道管理**：
```
GET    /api/admin/channels               列出
POST   /api/admin/channels               添加
PUT    /api/admin/channels/:code          更新
DELETE /api/admin/channels/:code          删除
PUT    /api/admin/channels/:code/toggle   启用/禁用
```

**模版 + 系统 Prompt**：
```
GET    /api/admin/channels/:code/template
PUT    /api/admin/channels/:code/template
PUT    /api/admin/channels/:code/template/reset
GET    /api/admin/channels/:code/system-prompt
PUT    /api/admin/channels/:code/system-prompt
PUT    /api/admin/channels/:code/system-prompt/reset
POST   /api/admin/channels/:code/system-prompt/interview    访谈式生成
```

**历史查询**：
```
GET    /api/admin/handovers               分页查询（channelCode/日期/关键词）
GET    /api/admin/handovers/:code/:month/:file  单条详情
```

**运行监控**：
```
GET    /api/admin/status                  系统状态（uptime, version, firstRun）
GET    /api/admin/llm-queue              LLM 队列状态
GET    /api/admin/logs                    最近日志
```

**Agent 管理**：
```
GET    /api/admin/channels/:code/agent/soul          获取灵魂设定（Markdown）
PUT    /api/admin/channels/:code/agent/soul          更新灵魂设定（Markdown content）
PUT    /api/admin/channels/:code/agent/soul/reset   重置灵魂设定
GET    /api/admin/channels/:code/agent/agents        获取行为规则（Markdown）
PUT    /api/admin/channels/:code/agent/agents        更新行为规则（Markdown content）
PUT    /api/admin/channels/:code/agent/agents/reset  重置行为规则
GET    /api/admin/channels/:code/agent/experience    列出经验规则
DELETE /api/admin/channels/:code/agent/experience/:id  删除经验规则
GET    /api/admin/channels/:code/agent/dream-config  获取反思配置
PUT    /api/admin/channels/:code/agent/dream-config  更新反思配置
POST   /api/admin/channels/:code/agent/dream/trigger  手动触发反思
```

---

## 七、Agent 智能系统

### 7.1 记忆闭环

```
LLM 分析消息时:
  buildContextPrompt() → getSoul() + getAgents() + getChannelMemory() + getExperience()
  → 拼接为 soulPrompt → 注入每次 LLM 调用

用户编辑预览时:
  旧内容 → detectDiffs() → recordDiffCandidate()
  → candidates.json 累积 → 重复≥2次 → writeCandidateToMemory() → channel-memory.md
  → extractMemoryForPrompt() → 下次 buildContextPrompt() 注入

用户编辑预览时:
  旧内容 ≠ 新内容 → analyzeEditIntent(LLM) → 生成经验规则
  → addEntry() → experience.json → buildExperiencePrompt() → 下次注入

交接归档后:
  dream-service → 计算修改率 → >30% → LLM 分析差异 → 生成候选记忆
  → 置信度≥0.8 → 自动写入 channel-memory.md
  → 置信度<0.8 → 保存到 dreaming/reviews/ 待人工审核
```

### 7.2 灵魂设定（Soul）

每个渠道可配置独立的 Agent 灵魂，使用 Markdown 格式（soul.md）：
- **我是谁**：人设描述（如"交班助手。记录、整理、交接。"）
- **我怎么说话**：语气风格（如"准确 > 华丽"）
- **我的边界**：行为边界（如"只处理与本班交接相关的内容"）

后台管理界面提供 Markdown 编辑器，可直接编辑 soul.md 内容。

### 7.3 行为规则（Agents）

默认规则：
- 优先级判断：涉及安全的标记为紧急，日常事项标记为一般
- 组织规范：按时间顺序组织，同类合并
- 禁忌：不编造未提及的信息

### 7.4 渠道记忆（Channel Memory）

`channel-memory.md` 四个区域，仅 `纠错记录` 和 `禁忌` 注入 LLM prompt：
- 用户偏好（暂不注入，供未来使用）
- 模式识别（暂不注入，供未来使用）
- 纠错记录（注入，如"紧急优先级应标'紧急'"）
- 禁忌（注入，如"不要猜测客人未提及的需求"）

### 7.5 经验规则（Experience）

来源有两种：
- **edit**（用户编辑）：用户修改 LLM 生成的预览 → `analyzeEditIntent()` 推断意图 → 生成规则
- **dream**（梦境反思）：交接后 LLM 反思差异 → 生成规则

### 7.6 梦境反思（Dream）

交接归档后自动触发：
1. 计算修改率（LLM 生成 vs 用户实际编辑的差异比例）
2. 修改率 >30% → LLM 分析差异，生成候选记忆
3. 置信度 ≥0.8 → 自动写入 channel-memory.md
4. 置信度 <0.8 → 保存到 `dreaming/reviews/` 待审核

### 7.7 Diff 检测

用户通过 H5 编辑预览时：
1. 对于仍保留 `<!-- msg:ID -->` 标记的条目：解析行内容，逐字段对比（urgency/category/content）
2. 对于标记被删除的条目：记录为 content diff（用户编辑/删除）
3. 所有 diff → `recordDiffCandidate()` → 累积在 `candidates.json`
4. 同类 diff 重复 ≥2 次 → 自动写入 `channel-memory.md` 纠错记录

---

## 八、权限控制

与管理后台鉴权相关的说明：
- 初版去除了 HTTP Basic Auth，管理后台无鉴权（信任内网环境）
- H5 Auth 仅用于身份识别（飞书 OAuth → open_id/name），不做权限校验
- 接班确认的身份校验：Mode A 确认人 ≠ 交班人，Mode B 确认人 = 交班人

---

## 九、交付与部署

### 9.1 部署方式

**Docker**：
```bash
docker compose up -d
# 映射端口 3000，挂载 ./data:/data，512MB 内存限制
```

**单可执行文件**：
```bash
npm run pkg   # 生成平台特定可执行文件
```

### 9.2 系统服务

- Linux：systemd 服务注册（`registerService`/`unregisterService`）
- Windows：日志提示手动配置
- Docker：容器自动重启

### 9.3 数据安全

- API Key、App Secret 等：AES-256-GCM 加密存储
- `ENCRYPTION_KEY` 环境变量：SHA-256 派生密钥
- 未设 `ENCRYPTION_KEY`：自动生成随机密钥存入 `data/config/.encryption-key`（mode 0o600）
- 丢失密钥：加密数据不可恢复

---

## 十、迭代计划

### Phase 1 — MVP（已实现）

- [x] 飞书 Bot 接入（Webhook + Signature 验签）
- [x] 多群支持（渠道工厂 + 按渠道 code 分区存储）
- [x] LLM 实时分析（文本/图片/语音多模态）
- [x] 草稿存储（raw.jsonl + analysis.json + preview.md + preview-items.json）
- [x] 交接卡片展示（含 H5 链接）
- [x] H5 移动端（草稿查看/编辑/交班/接班/打回）
- [x] H5 飞书 OAuth 认证
- [x] 两种交接模式（需确认/自行确认，均需 H5 确认）
- [x] Web 管理后台（Provider + 渠道 + 模版 + 历史）
- [x] Git 自动提交
- [x] Agent 智能系统（灵魂 + 行为规则 + 经验 + 渠道记忆 + 梦境反思）
- [x] 记忆闭环（buildContextPrompt 注入 memory + experience）
- [x] Diff 检测闭环（用户编辑 → 记忆候选 → 自动写入）
- [x] 经验学习闭环（用户编辑 → 意图推断 → 规则积累）
- [x] 模型路由（按 analyze/review 任务指定不同 Provider）
- [x] 系统 Prompt 访谈式生成
- [x] AES-256-GCM 加密存储
- [ ] 单可执行文件打包（pkg 脚本存在但未验证）
- [ ] systemd 服务注册（代码存在但未验证）

### Phase 2

- [ ] 企业微信/钉钉适配器
- [ ] SQLite 索引层（加速历史查询）
- [ ] PDF/Word 数据导出
- [ ] Git 历史可视化
- [ ] 更多 LLM Provider（Anthropic、智谱、通义千问）

---

## 十一、已确认决策

1. 数据存储使用 Markdown/JSON 文件，不使用数据库
2. Git 自动提交，30s 防抖
3. 草稿按群（渠道）分区，不按人
4. 飞书签名使用 SHA256，非 HMAC
5. 所有用户面向字符串使用中文
6. LLM Provider 必须兼容 OpenAI `/chat/completions` 接口
7. 无第三方 HTTP 客户端库，使用原生 http/https
8. 系统 Prompt 可配置，默认不假设业务场景
9. 交班指令仅通过群聊触发（@自己 交班），接班/打回通过 H5
10. 两种交接模式都需 H5 确认，不自动归档
11. 模型路由支持按任务指定不同 Provider
12. 草稿拆分为 4 个文件（raw/analysis/preview/preview-items）
13. preview-items.json 并行跟踪，用户编辑后按 marker 对账
14. 记忆闭环：channel-memory + experience 注入 buildContextPrompt
15. Diff 检测：用户编辑触发 → 候选累积 ≥2 次 → 自动写入记忆
16. 经验学习：用户编辑 → LLM 推断意图 → 规则积累
17. 梦境反思：交接后自动触发，高置信度自动写入
18. H5 认证使用飞书 OAuth，无认证时匿名回退
19. 管理后台无 HTTP 鉴权（信任内网环境）
20. Admin API 错误使用 sanitizeError() 不泄露堆栈

---

## 十二、更新历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.1 | 2026-04-21 | 审计修复：废弃 JSON soul 统一到 markdown、删 Dream 定时器死代码、分类与模版对齐、分析 prompt 补分类列表、H5 班次归属、路由回退日志、candidates TTL |
| v2.0 | 2026-04-20 | 全量更新：Agent 智能系统、H5 移动端、记忆闭环、模型路由、草稿架构重构、交接流程更新 |
| v1.8 | 2026-04-18 | 上下文注入、系统提示词编辑器、去除鉴权、文档同步 |
| v1.7 | 2026-04-17 | 上下文服务（上一班交接记录注入） |
| v1.6 | 2026-04-16 | 多模态支持、分析验证、引用消息上下文注入 |
| v1.5 | 2026-04-15 | 飞书适配器完善、渠道工厂、草稿服务 |
| v1.4 | 2026-04-14 | Web 管理后台、初始化向导 |
| v1.3 | 2026-04-13 | LLM Provider 工厂、队列、信号量 |
| v1.2 | 2026-04-12 | 基础架构设计 |
| v1.1 | 2026-04-11 | 初步需求分析 |
| v1.0 | 2026-04-10 | 产品概念确立 |