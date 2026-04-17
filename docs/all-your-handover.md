# All Your Handover - 产品设计文档

> **版本**：v1.4
> **日期**：2026-04-18
> **状态**：开发就绪
> **项目名**：All Your Handover
> **仓库/包名**：all-your-handover

---

## 一、产品定位

### 产品愿景
**All Your Handover**：简化版的、面向交班场景的 LLM Wiki 工具

> **名字由来**：一语双关——"所有交接数据归你所有" + 致敬经典极客梗"All your base are belong to us"。体现核心理念：数据在你手里，交接由你做主。

**参考**：小龙虾（LLM Wiki 应用框架），但专注交班场景，大幅简化

### 核心问题
原 SaaS 版本的痛点：
- 数据在厂商手中，合规风险高
- 后台设置复杂，需要配置员工、班次、权限等
- 需要数据库，运维门槛高

### 解决方案

**All Your Handover**：轻量级本地部署的酒店交接班工具

**核心主张**：
- **数据自有**：所有数据存储在客户本地，Markdown 文件格式
- **一键部署**：下载即用，单可执行文件零依赖
- **零配置启动**：无需预设员工表、班次表，开箱即用
- **多群支持**：一个实例服务多个群（前台群、客房群等）
- **多渠道支持**：飞书/企业微信/钉钉，初版先实现飞书
- **LLM 灵活配置**：Web 后台配置 Provider，支持多种模型

### 目标用户
- **首要用户**：前台员工（直接使用者）
- **次要用户**：前台主管/店长（管理视角，历史查询）

---

## 二、技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           IM 渠道层                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   飞书      │  │  企业微信    │  │    钉钉     │  │  更多...    │   │
│  │  (Phase 1) │  │  (Phase 2) │  │  (Phase 2)  │  │             │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
└─────────┼────────────────┼────────────────┼────────────────┼──────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        渠道适配层 (Channel Adapter)                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ChannelInterface                             │   │
│  │  - receiveMessage()    接收消息                                  │   │
│  │  - sendMessage()       发送消息                                  │   │
│  │  - sendCard()          发送消息卡片（交接内容展示）              │   │
│  │  - parseCommand()      解析群聊指令（交班/接班）                │   │
│  │  - getUserInfo()       获取用户信息                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │FeishuAdapter│  │WeComAdapter │  │DingTalkAdapter│                   │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
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
│                          LLM 服务层                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LLM Provider Factory                         │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐            │   │
│  │  │ OpenAI  │  │ DeepSeek │  │ Moonshot │  │ 更多... │            │   │
│  │  └─────────┘  └──────────┘  └─────────┘  └─────────┘            │   │
│  │                                                                  │   │
│  │  配置存储：data/config/llm-providers.json                        │   │
│  │  加载顺序：Web 后台配置 → 环境变量                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LLM 能力封装                                  │   │
│  │  - analyzeContent()   分析内容，提取结构化信息                   │   │
│  │  - generateHandover()  按模版生成交接单                          │   │
│  │  - analyzeImage()      多模态图片识别                            │   │
│  │  - analyzeVoice()      语音转文字（可选）                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          数据存储层                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Markdown 文件存储（Git 版本控制）                   │   │
│  │  data/                                                           │   │
│  │  ├── config/                         # 配置文件                 │   │
│  │  │   ├── llm-providers.json          # LLM Provider 配置        │   │
│  │  │   └── channels.json               # 渠道配置                 │   │
│  │  └── channels/                       # 按渠道 code 组织         │   │
│  │      └── {code}/                      # 如 qiantai/             │   │
│  │          ├── channel.json             # 运行时状态（配置在 channels.json）│   │
│  │          ├── template.md              # 渠道级模版              │   │
│  │          ├── handovers/2026-04/        # 交接记录               │   │
│  │          ├── drafts/ongoing.md         # 群级草稿                │   │
│  │          ├── drafts/pending.json       # 待交接记录              │   │
│  │          └── media/                    # 原始媒体               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              轻量级索引（Phase 2，加速查询）                     │   │
│  │  SQLite（仅存储索引，不存储内容）                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Web 管理后台                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  LLM 设置   │  │  渠道设置   │  │  模版设置   │  │  历史查询   │   │
│  │  Provider   │  │  飞书/企微  │  │  交接模版   │  │  交接记录   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 组件 | 技术选型 | 说明 |
|------|----------|------|
| 后端框架 | **TypeScript + Node.js** | 参考小龙虾（OpenClaw）架构，Gateway 模式 |
| 渠道 SDK | 飞书 SDK / 企业微信 SDK / 钉钉 SDK | 插件式适配 |
| LLM | 多 Provider（Web 后台配置）| OpenAI / Deepseek / Moonshot 等 |
| 数据存储 | Markdown 文件 | 主存储，轻量无依赖 |
| 版本控制 | Git（默认开启，静默运行） | 所有变更可追溯 |
| 前端 | **纯 HTML + 原生 JS** | 轻量级管理后台，无需构建工具 |
| 部署 | **单可执行文件 / Docker** | 两种方式，零依赖安装 |

### 架构设计原则

1. **渠道可扩展**：通过 ChannelInterface 抽象，支持飞书/企业微信/钉钉等
2. **LLM 可配置**：Web 后台管理 Provider，不写死在代码里
3. **数据透明**：Markdown 文件，用户可直接查看和编辑
4. **版本可控**：内置 Git（默认开启，静默运行），所有变更可追溯
5. **群聊交互优先**：所有员工操作在群聊内完成，无需额外登录
6. **极简部署**：酒店 IT 能力有限，安装即用，所有配置通过 Web 后台完成

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
如果该群没有草稿 → 自动创建草稿（ongoing.md）
        ↓
LLM 实时分析内容
        ↓
追加到群的当前交接草稿（Markdown）
        ↓
（默认不回复卡片，用户需查看时 @自己 草稿）
```

**特点**：
- 草稿是群级别的，不是个人的——一个群一个草稿
- 群内任何人发的消息都会追加到同一草稿
- 支持文本、图片、语音多模态
- LLM 每条消息实时调用，立即整理分类
- 消息过滤模式可按群配置（Web 后台设置）
- **指令触发与消息过滤是独立的**：指令（@自己 交班/接班/取消/草稿）始终可识别，不受 messageFilter 影响

### 3.2 草稿查看与编辑

**核心问题**：员工不能全靠 LLM "抽卡"，需要能查看和修改草稿内容。

**调研结论**：飞书消息卡片支持**表单容器**（输入框、下拉选择等），用户可在卡片内直接编辑后提交回调，无需离开群聊。这是最轻量的方案，完美保持"群聊即入口"的优势。

**方案：消息卡片内编辑**

```
员工在群聊发送：@自己 草稿
        ↓
程序读取该群的当前草稿，生成可编辑的消息卡片
        ↓
消息卡片内容：
  ┌─────────────────────────────────────────────────┐
  │  📋 当前交接草稿 - 前台群                        │
  │                                                  │
  │  【房态核对】                                     │
  │  ┌─────────────────────────────────────────────┐ │
  │  │ 已入住：85 间          [可编辑输入框]        │ │
  │  │ 空房：10 间            [可编辑输入框]        │ │
  │  │ 维修房：3 间           [可编辑输入框]        │ │
  │  └─────────────────────────────────────────────┘ │
  │                                                  │
  │  【待办事项】（折叠面板，可展开）                  │
  │  - 302 加床                                      │
  │  - VIP 客人 18:00 到店                           │
  │                                                  │
  │  【原始随手记】（折叠面板，默认折叠）              │
  │  > 14:30 张三: 302 客人要加床                    │
  │  > 15:00 张三: [图片] VIP 客人信息               │
  │                                                  │
  │  [✓ 保存修改]  [🔄 重新整理]  [📤 发起交接]     │
  └─────────────────────────────────────────────────┘
        ↓
员工点击"保存修改" → 卡片回调提交修改内容 → 程序更新草稿
员工点击"重新整理" → 程序调 LLM 重新整理草稿 → 更新卡片
员工点击"发起交接" → 等同于"@自己 交班"
```

**技术依据**：
- 飞书卡片表单容器支持 `input`（输入框，含 `default_value` 预填）、`select_static`（下拉选择）、`date_picker` 等
- 卡片回调 3 秒内返回新卡片 JSON 即可即时更新
- 折叠面板（`collapsible_panel`）可收纳原始随手记，默认折叠
- 按钮组件支持 `confirm`（二次确认弹窗），适合"发起交接"等关键操作

**设计权衡**：
| 方案 | 优点 | 缺点 | 是否采用 |
|------|------|------|----------|
| 消息卡片内编辑 | 不离开群聊、最轻量 | 表单字段有限、不适合长文本编辑 | **采用** |
| H5 侧边栏页面 | 功能完整、可做富文本编辑 | 需额外开发、跳离群聊体验 | 备选（Phase 2） |
| 飞书小程序 | 功能最完整 | 开发成本高、需审核上架 | 不采用 |

### 3.3 交接流程

**核心理念：群聊消息交互，无需审批流，简单直接**

**模式 A：需要接班确认（requireAccept = true）**

```
交班人在群聊发送：@自己 交班
        ↓
程序收到交班指令
        ↓
LLM 按模版整理当前草稿生成交接单
        ↓
程序向群聊发送交接消息卡片（完整交接内容）
        ↓
  ├─ 群内任何人发送：@自己 接班 → 确认交接完成
  │       ↓
  │   保存交接记录（Markdown），清空草稿和待交接
  │       ↓
  │   向群聊推送"交接完成"确认消息卡片
  │
  └─ 任何人发送：@自己 取消 → 取消待交接
          ↓
      删除待交接记录，草稿保留
          ↓
      向群聊推送"交接已取消"消息
```

**模式 B：不需要接班确认（requireAccept = false）**

```
交班人在群聊发送：@自己 交班
        ↓
程序收到交班指令
        ↓
LLM 按模版整理当前草稿生成交接单
        ↓
直接保存交接记录（Markdown），清空草稿
        ↓
向群聊推送"交接已归档"确认消息卡片
```

**特点**：
- 纯群聊消息交互，无需审批流，极简
- 交班人发"@自己 交班"触发
- 接班人不指定，群内任何人发"@自己 接班"即可确认（模式 A）
- 交班人可发"@自己 取消"撤销待交接，草稿保留
- 群级别配置是否需要接班确认（Web 后台设置）
- 交接内容通过消息卡片展示，群内所有人可见
- 同一群同一时间只允许一份待交接草稿
- 无拒绝流程，不满意可在群里沟通后重新交班

### 3.4 历史查询

**员工**：翻群里的消息卡片即可，无需登录任何系统

**管理员**：访问 Web 后台页面查询

```
管理员打开 Web 管理后台
        ↓
输入查询条件（日期/关键词/参与者）
        ↓
程序搜索 Markdown 文件
        ↓
返回匹配的交接记录列表
        ↓
点击查看详情
```

---

## 四、数据模型

### 4.1 配置文件结构

```
data/
├── config/
│   ├── llm-providers.json    # LLM Provider 配置（Web 后台管理）
│   ├── channels.json          # 渠道配置（多群合并配置）
│   └── .encryption-key        # 自动生成的 AES-256 加密密钥（丢失将导致 API Key 不可恢复）
├── channels/                  # 按渠道 code 组织数据
│   └── qiantai/               # code: "qiantai"（创建渠道时指定，仅英文+数字）
│       ├── channel.json        # 渠道运行时状态（非配置，不与 channels.json 重复）
│       ├── template.md         # 交接模版（渠道级别，不同群可用不同模版）
│       ├── handovers/          # 交接记录
│       │   └── 2026-04/
│       │       ├── 2026-04-01_ou_xxx_ou_yyy.md
│       │       └── 2026-04-02_ou_yyy_ou_zzz.md
│       ├── drafts/             # 草稿（群级别，每次交接后清空）
│       │   └── ongoing.md      # 当前草稿（群内所有消息汇集）
│       │   └── pending.json    # 待交接记录（requireAccept=true 时暂存，程序重启后可恢复）
│       └── media/              # 原始媒体文件
│           ├── images/
│           └── audio/
├── logs/                      # 运行日志
│   └── app.log
└── .git/                      # Git 版本控制（自动初始化，默认开启）
```

> **命名规则**：所有文件和目录名仅使用英文+数字+下划线，避免中文路径编码问题。渠道创建时必须指定 `code`（如 `qiantai`、`kefang`），`name`（如"前台群"、"客房群"）仅用于显示。

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
    },
    {
      "id": "moonshot-1",
      "name": "Moonshot",
      "type": "moonshot",
      "apiKey": "sk-yyy（加密存储）",
      "baseUrl": "https://api.moonshot.cn",
      "model": "moonshot-v1-8k",
      "isDefault": false,
      "isEnabled": false,
      "createdAt": "2026-04-02T10:00:00Z",
      "updatedAt": "2026-04-02T10:00:00Z"
    }
  ],
  "defaultProviderId": "deepseek-1"
}
```

### 4.3 渠道配置（config/channels.json）

> **设计说明**：同一渠道平台（如飞书）的 App 凭证（appId/appSecret）为平台共享配置，放在 `platforms` 层级；每个渠道（群）仅存储自己的 `chatId` 和业务设置。避免多群重复填写相同凭证，也方便密钥轮换时一次修改。

```json
{
  "platforms": {
    "feishu": {
      "appId": "cli_xxx",
      "appSecret": "xxx（加密存储）",
      "verificationToken": "xxx（加密存储，用于验签）"
    }
  },
  "channels": [
    {
      "code": "qiantai",
      "type": "feishu",
      "name": "前台群",
      "chatId": "oc_xxx",
      "settings": {
        "requireAccept": true,
        "messageFilter": "all"
      },
      "isEnabled": true
    },
    {
      "code": "kefang",
      "type": "feishu",
      "name": "客房群",
      "chatId": "oc_yyy",
      "settings": {
        "requireAccept": false,
        "messageFilter": "all"
      },
      "isEnabled": true
    }
  ]
}
```

**渠道配置字段说明**：

**平台级配置（platforms）**：
| 字段 | 说明 | 约束 |
|------|------|------|
| `feishu.appId` | 飞书自建应用 App ID | 同一平台所有渠道共享 |
| `feishu.appSecret` | 飞书自建应用 App Secret | 加密存储，同一平台所有渠道共享 |
| `feishu.verificationToken` | 飞书事件订阅验签 Token | 加密存储，用于验证 webhook 请求来源 |

**渠道级配置（channels）**：
| 字段 | 说明 | 约束 |
|------|------|------|
| `code` | 渠道唯一标识，用于文件目录命名 | 仅英文+数字+下划线，创建后不可修改 |
| `type` | 渠道类型 | feishu / wecom / dingtalk |
| `name` | 显示名称 | 中文可读，可随时修改 |
| `chatId` | 群聊 ID（如飞书的 `oc_xxx`） | 创建后不可修改 |
| `settings.requireAccept` | 是否需要接班人确认 | true / false |
| `settings.messageFilter` | 消息过滤模式 | `all`：处理群内所有消息 / `mention`：仅处理消息中 @了机器人 的消息 |

**渠道运行时状态（channels/{code}/channel.json）字段说明**：

> **注意**：此文件存储渠道运行时状态，不存储配置。所有配置（requireAccept、messageFilter 等）以 `channels.json` 为唯一数据源，由 Web 后台管理。`channel.json` 仅为运行时缓存，程序启动时从 `channels.json` 同步。

| 字段 | 说明 | 用途 |
|------|------|------|
| `lastMessageAt` | 最后一条消息时间 | 运行时状态，用于监控 |
| `draftMessageCount` | 当前草稿消息条数 | 运行时状态，用于监控 |

> **更新时机**：`lastMessageAt` 和 `draftMessageCount` 在 `appendToDraft` 中更新，`clearDraft` 时重置。仅用于 Web 后台运行监控展示，非关键路径，写入失败不影响业务。

### 4.4 交接模版（channels/{code}/template.md）

> **渠道级别**：每个渠道独立配置模版，不同群可用不同模版（前台群关注房态钱款，客房群关注清洁维修）。新建渠道时自动生成默认模版，可通过 Web 后台编辑。
>
> **格式说明**：使用 `{{placeholder}}` 占位符模版，LLM 根据 placeholder 名称填充对应分类的内容。

```markdown
# 交接模版

## 重要事项
{{important}}

## 一般事项
{{normal}}

## 跟进事项
{{follow_up}}
```

### 4.5 交接记录（channels/qiantai/handovers/2026-04/2026-04-01_ou_xxx_ou_yyy.md）

> **文件命名**：`{YYYY-MM-DD}_{交班人channel_user_id}_{接班人channel_user_id}.md`（requireAccept=false 时接班人 ID 为 `archived`）。中文姓名保留在文件内容的 frontmatter 中，文件名仅用英文+数字+下划线。
>
> **记录 ID**：`hv_{UUID}` 格式（如 `hv_a1b2c3d4e5f6...`），使用 UUID 而非自增序号以避免并发冲突。

```markdown
---
id: hv_a1b2c3d4e5f6
channel_code: qiantai
channel_name: 前台群
chat_id: oc_xxx
created_at: 2026-04-01 16:00:00
sender:
  name: 张三
  channel_user_id: ou_xxx
receiver:
  name: 李四
  channel_user_id: ou_yyy
status: completed
require_accept: true
completed_at: 2026-04-01 16:30:00
---

> **requireAccept=false 时**：receiver 为空（`name: ""` / `channel_user_id: ""`），status 为 `archived`，无 completed_at 字段。

# 交接单 - 2026年4月1日 前台群

## 基本信息
- 交班人：张三
- 接班人：李四
- 交接时间：2026-04-01 16:00
- 群：前台群

## 房态核对
- 已入住：85 间
- 空房：10 间
- 维修房：3 间
- 预订未到：2 间

## 钱款交接
- 现金：¥5,200
- 微信收款：¥12,800
- 支付宝收款：¥8,500
- 备用金：¥1,000

## 待办事项
- [ ] 302 房间客人需要加床
- [ ] VIP 客人预计 18:00 到店
- [ ] 空调维修师傅明天来

## 特殊情况说明
- 102 房间客人投诉空调噪音大，已报修
- 会员卡刷卡机偶尔卡顿，已联系技术支持

## 原始随手记
> 14:30 张三: 302 房间客人说要加床
> 15:00 张三: [图片] VIP 客人信息
> 15:30 张三: 空调师傅说明天来修 102 房间的空调
```

### 4.6 交接草稿（channels/qiantai/drafts/ongoing.md）

> **关键设计**：草稿是群级别的，不是个人的。一个群同一时间只有一个草稿。交接完成后草稿清空，群内新消息自动创建新草稿。目录名使用渠道 `code`（如 `qiantai`），避免中文路径问题。

```markdown
---
channel_code: qiantai
channel_name: 前台群
chat_id: oc_xxx
started_at: 2026-04-01 08:00
updated_at: 2026-04-01 15:30
---

# 前台群 - 当前交接草稿

## 记录内容
- 14:30 张三: 302 房间客人需要加床
- 15:00 张三: [图片] VIP 客人信息
- 15:30 李四: 空调师傅明天来修

## LLM 整理预览（实时更新）
- 待办：302 加床
- 待跟进：VIP 客人 18:00 到店
- 待处理：102 空调维修
```

### 4.7 待交接记录（channels/qiantai/drafts/pending.json）

> **用途**：当 requireAccept=true 时，交班人生成交接单后、接班人确认前，暂存交接数据。程序重启后可恢复待交接状态。

```json
{
  "channelCode": "qiantai",
  "sender": {
    "id": "ou_xxx",
    "name": "张三"
  },
  "content": "# 交接单 - 2026年4月1日 前台群\n\n## 房态核对\n...(完整交接 Markdown 内容)",
  "createdAt": "2026-04-01T16:00:00Z"
}
```

> **生命周期**：交班时写入 → 接班确认后删除；交班取消后删除。

---

## 五、渠道适配层设计

### 5.1 渠道接口抽象

```typescript
// 渠道适配器接口
interface ChannelAdapter {
  // 基本信息
  readonly type: 'feishu' | 'wecom' | 'dingtalk' | 'slack' | 'telegram';
  readonly code: string;   // 渠道标识（英文+数字+下划线，用于文件路径）
  readonly name: string;   // 显示名称（中文，可随时修改）

  // 初始化
  initialize(config: ChannelConfig): Promise<void>;

  // 消息相关
  receiveMessage(event: any): Promise<Message | null>;
  sendMessage(chatId: string, message: MessageContent): Promise<void>;
  // 推送富文本卡片（交接内容展示、交接完成确认）
  sendCard(chatId: string, card: CardContent): Promise<void>;

  // 指令识别（群聊交互核心）
  // "@自己 交班" → 触发交班流程
  // "@自己 接班" → 触发接班确认
  // "@自己 草稿" → 查看/编辑草稿
  parseCommand(message: Message): Command | null;

  // 用户相关
  getUserInfo(userId: string): Promise<UserInfo>;
  getChatMembers(chatId: string): Promise<UserInfo[]>;

  // 事件订阅
  subscribe(event: string, handler: EventHandler): void;
}

// 统一消息结构
interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  sender: UserInfo;
  content: Content;
  type: 'text' | 'image' | 'audio' | 'unknown';
  timestamp: number;
  mentionsBot: boolean;   // 消息中是否 @了机器人
  mentionList: string[];  // 被 @的用户 ID 列表
}

// 指令类型
type Command =
  | { type: 'HANDOVER_START'; sender: UserInfo }    // 交班人发起交班
  | { type: 'HANDOVER_ACCEPT'; sender: UserInfo }   // 接班人确认接班
  | { type: 'HANDOVER_CANCEL'; sender: UserInfo }   // 交班人取消待交接
  | { type: 'DRAFT_VIEW'; sender: UserInfo };       // 查看编辑草稿

// 群级别配置
interface ChannelSettings {
  requireAccept: boolean;    // 是否需要接班确认（true: 需要接班人确认, false: 交班直接归档）
  messageFilter: 'all' | 'mention';  // all: 处理所有消息 / mention: 仅处理 @机器人的消息
}
```

### 5.2 飞书适配器（Phase 1 实现）

```typescript
class FeishuAdapter implements ChannelAdapter {
  readonly type = 'feishu';
  readonly code: string;
  readonly name: string;

  private client: FeishuClient;
  private botOpenId: string;
  private userInfoCache: Map<string, UserInfo> = new Map();  // 缓存用户信息，减少 API 调用

  constructor(code: string, name: string) {
    this.code = code;
    this.name = name;
  }

  async initialize(config: { platform: FeishuPlatformConfig; chatId: string }): Promise<void> {
    this.client = new FeishuClient({
      appId: config.platform.appId,
      appSecret: config.platform.appSecret,
    });
    this.botOpenId = (await this.client.getBotInfo()).open_id;
  }

  // 接收消息
  async receiveMessage(event: FeishuEvent): Promise<Message | null> {
    if (event.event.type !== 'message') return null;

    const message = event.event.message;
      const senderInfo = await this.getUserInfo(message.sender_id.open_id);  // 有缓存，高频消息不重复调 API

      // 解析消息中被 @的用户列表
      const mentionList = message.mentions?.map((m: any) => m.id.open_id) || [];
      const mentionsBot = mentionList.includes(this.botOpenId);

      return {
        id: message.message_id,
        chatId: message.chat_id,
        senderId: message.sender_id.open_id,
        senderName: senderInfo.name,
        sender: senderInfo,
        content: await this.parseMessageContent(message),
        timestamp: message.create_time,
        type: message.message_type,
        mentionsBot,
        mentionList,
      };
  }

  // 解析消息内容（支持多模态）
  private async parseMessageContent(message: FeishuMessage): Promise<Content> {
    const contentObj = JSON.parse(message.content);  // 飞书消息 content 始终为 JSON 字符串
    switch (message.message_type) {
      case 'text':
        return { type: 'text', text: contentObj.text };
      case 'image':
        const imageData = await this.client.downloadImage(contentObj.image_key);
        return { type: 'image', data: imageData };
      case 'audio':
        const audioData = await this.client.downloadAudio(contentObj.file_key);
        return { type: 'audio', data: audioData };
      default:
        return { type: 'unknown' };
    }
  }

  // 解析群聊指令
  // "@自己 交班" → HANDOVER_START
  // "@自己 接班" → HANDOVER_ACCEPT
  // "@自己 取消" → HANDOVER_CANCEL（取消待交接）
  // "@自己 草稿" → DRAFT_VIEW（查看/编辑草稿）
  //
  // "自己"指发送者本人——用户在群聊中 @自己 + 关键词触发指令
  // （不是 @机器人，@机器人仅用于 messageFilter=mention 的消息过滤）
  // 检测方式：senderId 是否出现在 mentionList 中（用户 @了自己）
  parseCommand(message: Message): Command | null {
    if (message.type !== 'text') return null;
    const text = message.content.text.trim();

    // 检查发送者是否 @了自己（senderId 出现在 mentionList 中）
    const selfMentioned = message.mentionList.includes(message.senderId);
    if (!selfMentioned) return null;

    if (text.includes('交班')) {
      return { type: 'HANDOVER_START', sender: message.sender };
    }
    if (text.includes('接班')) {
      return { type: 'HANDOVER_ACCEPT', sender: message.sender };
    }
    if (text.includes('取消')) {
      return { type: 'HANDOVER_CANCEL', sender: message.sender };
    }
    if (text.includes('草稿')) {
      return { type: 'DRAFT_VIEW', sender: message.sender };
    }
    return null;
  }

  // 获取用户信息（带缓存，避免频繁调飞书 API 触发限流）
  async getUserInfo(userId: string): Promise<UserInfo> {
    if (this.userInfoCache.has(userId)) {
      return this.userInfoCache.get(userId)!;
    }
    const info = await this.client.getUserInfo(userId);
    this.userInfoCache.set(userId, info);
    return info;
  }
}
```

### 5.3 渠道工厂

```typescript
class ChannelFactory {
  private adapters: Map<string, ChannelAdapter> = new Map();

  // 创建渠道适配器
  create(type: string, channelConfig: ChannelConfig, platformConfig: PlatformConfig): ChannelAdapter {
    let adapter: ChannelAdapter;

    switch (type) {
      case 'feishu':
        adapter = new FeishuAdapter(channelConfig.code, channelConfig.name);
        break;
      case 'wecom':
        adapter = new WeComAdapter(channelConfig.code, channelConfig.name);
        break;
      case 'dingtalk':
        adapter = new DingTalkAdapter(channelConfig.code, channelConfig.name);
        break;
      default:
        throw new Error(`Unsupported channel type: ${type}`);
    }

    adapter.initialize({ platform: platformConfig, chatId: channelConfig.chatId });
    this.adapters.set(channelConfig.code, adapter);
    return adapter;
  }

  // 获取渠道适配器
  get(code: string): ChannelAdapter {
    return this.adapters.get(code);
  }
}
```

### 5.4 支持的渠道优先级

| 渠道 | 状态 | 说明 |
|------|------|------|
| 飞书 | Phase 1 | 首个实现，消息卡片支持完善 |
| 企业微信 | Phase 2 | 群聊交互类似 |
| 钉钉 | Phase 2 | 群聊交互类似 |
| Slack | Future | 海外市场 |
| Telegram | Future | 海外市场 |

### 5.5 飞书消息接收技术说明

飞书 Bot 在群聊中接收消息有两种模式：

| 模式 | 说明 | 对应 messageFilter |
|------|------|-------------------|
| **默认模式** | Bot 仅收到 @自己的消息 | `mention` |
| **全量接收模式** | Bot 收到群内所有消息 | `all` |

**启用全量接收模式**需在飞书开放平台 → 应用功能 → 机器人 → 开启"接收群聊中所有消息"。此功能需企业自建应用管理员权限。

> **初始化向导提示**：当用户选择 messageFilter=all 时，向导应提示需要在飞书开放平台开启"接收群聊中所有消息"功能，否则 Bot 无法收到未 @自己的消息。

**飞书 Webhook 配置**：

飞书开放平台需要配置事件订阅 URL：`https://你的服务器地址:3000/webhook/feishu`。程序启动后此 URL 即可用。需要在飞书开放平台完成以下配置：
1. 事件订阅 → 请求地址 → 填入 Webhook URL → 完成验证（程序自动响应 challenge）
2. 事件订阅 → 添加事件 → `im.message.receive_v1`（接收消息）
3. 机器人 → 开启"接收群聊中所有消息"（如需 messageFilter=all）

> **初始化向导 Step 2**：配置飞书应用后，向导显示 Webhook URL 并提示用户在飞书开放平台完成事件订阅配置，含"测试连接"按钮验证配置是否成功。

---

## 六、LLM Provider 设计

### 6.1 Provider 接口抽象

```typescript
interface LLMProvider {
  readonly id: string;
  readonly type: string;
  readonly name: string;

  initialize(config: LLMConfig): Promise<void>;

  // 文本分析
  analyzeText(params: AnalyzeTextParams): Promise<AnalyzeResult>;

  // 多模态 - 图片分析
  analyzeImage(params: AnalyzeImageParams): Promise<AnalyzeResult>;

  // 多模态 - 语音转文字
  transcribeAudio(params: TranscribeParams): Promise<string>;

  // 生成交接单
  generateHandover(params: GenerateHandoverParams): Promise<string>;
}
```

### 6.2 Provider 工厂

```typescript
class LLMProviderFactory {
  private providers: Map<string, LLMProvider> = new Map();
  private config: LLMProvidersConfig;

  async initializeAll(): Promise<void> {
    for (const c of this.config.providers) {
      if (c.isEnabled) await this.create(c);
    }
  }

  private async create(config: LLMProviderConfig): Promise<LLMProvider> {
    let provider: LLMProvider;
    switch (config.type) {
      case 'openai':    provider = new OpenAIProvider(); break;
      case 'deepseek':  provider = new DeepSeekProvider(); break;
      case 'moonshot':  provider = new MoonshotProvider(); break;
      case 'anthropic':  provider = new AnthropicProvider(); break;
      case 'zhipu':      provider = new ZhipuProvider(); break;
      default: throw new Error(`Unsupported: ${config.type}`);
    }
    await provider.initialize(config);
    this.providers.set(config.id, provider);
    return provider;
  }

  getDefault(): LLMProvider {
    return this.providers.get(this.config.defaultProviderId);
  }

  get(id: string): LLMProvider {
    return this.providers.get(id);
  }
}
```

### 6.3 支持的 Provider

| Provider | 状态 | 特点 |
|----------|------|------|
| OpenAI | Phase 1 | GPT-4 多模态支持 |
| DeepSeek | Phase 1 | 国内访问稳定，性价比高 |
| Moonshot | Phase 1 | 长文本支持 |
| Anthropic | Phase 2 | Claude 多模态 |
| 智谱 AI | Phase 2 | 国内大模型 |
| 通义千问 | Phase 2 | 阿里云大模型 |

### 6.4 Web 后台 Provider 管理

```
┌─────────────────────────────────────────────────────────┐
│  LLM Provider 设置                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [+ 添加 Provider]                                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ DeepSeek                          [默认] [编辑] │   │
│  │ 模型: deepseek-chat                              │   │
│  │ 状态: 已启用 ●                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Moonshot                          [设为默认] [编辑] │   │
│  │ 模型: moonshot-v1-8k                             │   │
│  │ 状态: 已禁用 ○                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.5 Provider 配置 API

```
POST   /api/admin/llm-providers          添加 Provider
PUT    /api/admin/llm-providers/:id       更新 Provider
PUT    /api/admin/llm-providers/:id/default  设为默认
PUT    /api/admin/llm-providers/:id/toggle  启用/禁用
DELETE /api/admin/llm-providers/:id       删除 Provider
```

配置存储在 `data/config/llm-providers.json`，通过 Web 后台管理，不写死在代码中。GET 响应中 API Key 以 `***` 掩码显示。

### 6.6 平台配置 API

```
GET    /api/admin/platforms/:type          获取平台配置（如 feishu），密钥掩码显示
PUT    /api/admin/platforms/:type          更新平台配置（App ID/Secret）
POST   /api/admin/platforms/:type/test     测试平台连接（验证 App 凭证有效性）
```

平台密钥（appSecret、verificationToken）均使用 AES-256-GCM 加密存储。

### 6.7 渠道管理 API

```
GET    /api/admin/channels               列出所有渠道
POST   /api/admin/channels               添加渠道（code + name + chatId + type + settings）
PUT    /api/admin/channels/:code          更新渠道配置（name/chatId/settings）
DELETE /api/admin/channels/:code          删除渠道
PUT    /api/admin/channels/:code/toggle   启用/禁用渠道
```

渠道 code 限制为 1-50 字符的字母/数字/下划线，名称限制 100 字符，chatId 限制 200 字符。

### 6.8 交接模版 API

```
GET    /api/admin/channels/:code/template     获取渠道模版
PUT    /api/admin/channels/:code/template     更新渠道模版
PUT    /api/admin/channels/:code/template/reset  重置为默认模版
```

### 6.9 历史查询 API

```
GET    /api/admin/handovers                   查询交接记录
       ?channelCode=qiantai                   按渠道筛选
       &startDate=2026-04-01                  起始日期
       &endDate=2026-04-30                    截止日期
       &keyword=空调                           关键词搜索
       &page=1                                页码（默认 1）
       &pageSize=20                           每页条数（默认 20，最大 1000）
GET    /api/admin/handovers/:channelCode/:month/:file  获取交接记录详情
```

搜索方式：遍历 `data/channels/{code}/handovers/` 下的 Markdown 文件，按 frontmatter 字段和正文内容匹配。详情 API 路径参数经过严格校验防止路径遍历。Phase 2 引入 SQLite 索引后改为数据库查询。

### 6.10 运行监控 API

```
GET    /api/admin/status                      系统状态（运行时长、渠道数、Provider 数、首次运行标记）
GET    /api/admin/llm-queue                   LLM 队列状态（各渠道积压数、活跃调用数）
GET    /api/admin/logs                        最近运行日志（?lines=100，最大 1000）
GET    /health                                健康检查（返回 status + version）
```

---

## 七、权限控制

| 角色 | 权限 | 说明 |
|------|------|------|
| 群聊成员 | 发送随手记、@自己 交班/接班、查看群内消息卡片 | 无需登录系统 |
| 管理员 | 配置系统、查看所有交接记录、管理 LLM/渠道 | 通过 Web 后台，可选 Bearer Token 鉴权 |

**Web 后台鉴权策略**：
- **默认无登录校验**：能访问服务器端口即视为管理员（适用于内网部署）
- **可选 ADMIN_TOKEN 鉴权**：设置 `ADMIN_TOKEN` 环境变量后，所有 Admin API 请求需携带 `Authorization: Bearer <token>` 请求头，使用 `timingSafeEqual` 防时序攻击
- 依赖操作系统自身鉴权机制（防火墙、VPN、内网隔离等）
- 部署文档中建议：仅绑定 127.0.0.1 或通过防火墙限制访问

**员工查看历史记录**：
- 翻群里的消息卡片即可，无需登录任何系统
- 消息卡片包含完整交接内容，可随时翻阅

**管理员查看历史记录**：
- 通过 Web 后台页面查询
- 支持按日期、关键词、参与者筛选

### 7.1 配置层级总览

> 所有配置均通过 Web 后台完成，无需手动编辑文件。

| 配置项 | 配置级别 | 默认值 | 说明 |
|--------|---------|--------|------|
| LLM Provider | 系统级 | 无（初始化向导必填）| API Key、模型、端点 |
| 默认 LLM Provider | 系统级 | 第一个添加的 Provider | 多 Provider 时指定默认 |
| 交接模版 | 渠道级 | 内置默认模版 | 自由 Markdown，LLM 理解结构，不同群可用不同模版 |
| 渠道（群）| 系统级 | 无（初始化向导必填）| code + name + 飞书 App 配置 |
| requireAccept | 渠道级 | `true` | 是否需要接班人确认 |
| messageFilter | 渠道级 | `all` | all: 处理所有消息 / mention: 仅 @机器人 |
| Git 版本控制 | 内置（默认开启）| 开启 | 静默运行，无需配置 |
| 随手记卡片预览回复 | 内置（默认关闭）| 关闭 | 用户 @自己 草稿 查看 |
| SQLite 索引 | Phase 2 | — | MVP 不引入 |
| LLM 全局并发数 | 系统级 | 3 | Web 后台可调，适配不同 Provider 速率限制 |
| LLM 调用队列 | 内置（两级）| 渠道保序 + 全局限并发 | 原文先入草稿，分析异步补充 |

---

## 八、交付与部署

> **核心原则**：酒店 IT 能力有限，甚至可能没有 IT。安装必须傻瓜操作，配置必须全部通过 Web 页面完成。

### 8.1 部署方式

**方式一：单可执行文件（推荐，零依赖）**

无需安装 Node.js、Docker 等任何运行时。下载即用。

```bash
# Linux
wget https://github.com/all-your-handover/releases/latest/all-your-handover-linux-amd64
chmod +x all-your-handover-linux-amd64
./all-your-handover-linux-amd64

# Windows
# 下载 all-your-handover-windows-amd64.exe
# 双击运行
```

启动后自动完成：
1. 检测并创建数据目录（默认 `./data`）
2. 初始化默认配置文件
3. 注册为系统服务（开机自启）
4. 启动 Web 服务（默认 `http://localhost:3000`）
5. 打开浏览器访问 → 进入初始化向导 → 配置 LLM + 飞书 → 开始使用

**方式二：Docker（适合有 Docker 环境的酒店）**

```bash
docker run -d \
  --name all-your-handover \
  -p 3000:3000 \
  -v ./data:/app/data \
  allyourhandover/server:latest
```

> 无需环境变量。所有业务配置（LLM API Key、飞书 App ID 等）均在 Web 后台页面配置，不通过命令行或配置文件操作。

### 8.2 支持的操作系统

| 操作系统 | 支持 | 说明 |
|---------|------|------|
| Linux (amd64) | ✅ | 主力支持，单可执行文件部署 |
| Linux (arm64) | ✅ | 支持国产服务器 |
| Windows 10/11 | ✅ | 双击 exe 运行 |
| Windows Server | ✅ | 企业常见环境 |
| macOS | ✅ | 开发测试用 |

### 8.3 安装后体验（零配置文件操作）

**目标**：用户安装后只需打开 Web 页面，无需接触任何配置文件或命令行。

```
下载 → 运行 → 浏览器打开 http://localhost:3000
                         ↓
               ┌─────────────────────┐
               │  初始化向导          │
               │                     │
               │  Step 1: 配置 LLM   │
               │  （选 Provider、填  │
               │   API Key、选模型）  │
               │                     │
               │  Step 2: 配置飞书   │
               │  （填 App ID/Secret │
               │   + 验签 Token）    │
               │                     │
               │  Step 3: 添加渠道   │
               │  （code + 名称 +    │
               │   群 Chat ID +      │
               │   是否需要接班确认） │
               │                     │
               │  Step 4: 编辑模版   │
               │  （默认模版可改）    │
               │                     │
               │  [完成] → 进入主界面│
               └─────────────────────┘
```

**首次运行检测**：
- 程序启动时检测 `data/config/` 是否存在
- 不存在 → 自动创建默认配置，Web 首页显示初始化向导
- 已存在 → 直接进入主界面

**后续所有配置变更**均通过 Web 后台页面完成，包括：
- 添加/修改/删除 LLM Provider
- 添加/修改/删除渠道
- 修改交接模版
- 修改群级别设置（requireAccept / messageFilter）
- 查看运行日志和 LLM 调用统计

### 8.4 系统服务（默认注册）

安装后自动注册为系统服务，开机自启：

- **Linux**：注册为 systemd 服务
- **Windows**：注册为 Windows 服务

> **权限要求**：注册系统服务需要管理员权限。Linux 需 sudo 运行，Windows 需右键"以管理员身份运行"。若无管理员权限，程序仍可正常运行（前台模式），仅跳过服务注册。

如需卸载服务：

```bash
# Linux
./all-your-handover uninstall

# Windows
all-your-handover.exe uninstall
```

### 8.5 多酒店部署

**同一服务器多实例**：

```bash
# 实例 1（前台，端口 3001）
./all-your-handover --port 3001 --data ./hotel-a-data

# 实例 2（客房，端口 3002）
./all-your-handover --port 3002 --data ./hotel-b-data
```

> 仅两个参数：`--port`（端口）和 `--data`（数据目录）。无需其他命令行配置。

**不同服务器**：每个酒店一台服务器，各自独立部署。

### 8.6 数据安全

- 所有数据存储在客户本地
- API Key 使用 AES-256-GCM 加密存储在 JSON 配置中，格式为 `iv:authTag:ciphertext`（hex 编码，冒号分隔）
- 加密密钥来源优先级：`ENCRYPTION_KEY` 环境变量（SHA-256 派生） > 自动生成的 256-bit 随机密钥（持久化到 `data/config/.encryption-key`）
- **重要**：`.encryption-key` 文件是加密密钥的唯一本地副本，丢失将导致所有已加密的 API Key 不可恢复。备份时必须包含此文件
- 飞书 webhook 回调签名验证使用 `crypto.timingSafeEqual`（防止时序攻击），5 分钟防重放
- Markdown 草稿写入时对用户输入进行安全净化（转义 `##` 标题和 `<!--` HTML 注释标记符，防止注入破坏草稿结构）
- 交接记录 frontmatter 值使用 YAML 安全引号包裹（防止 YAML 注入）
- 历史 API 的路径参数进行正则校验（防止路径遍历攻击）
- Admin API GET 响应中 API Key 以 `***` 掩码显示
- HTTP 请求体大小限制为 10MB
- 内置 Git 版本控制（默认开启，静默运行），所有草稿和交接文件变更自动提交
- 数据目录可直接备份（复制文件夹即可，需包含 `.encryption-key`）

---

## 九、技术实现细节

### 9.1 渠道事件处理（群聊指令 + 随手记）

```typescript
// 飞书 Webhook 入口（单一端点，飞书将所有事件推送到此 URL）
// 飞书开放平台配置此 URL 为事件接收地址
app.post('/webhook/feishu', async (req, res) => {
  // 飞书签名验证（防伪造）
  if (!verifyFeishuSignature(req)) {
    return res.status(403).json({ code: -1, msg: '签名验证失败' });
  }

  // 飞书事件订阅验证（首次配置时飞书发送 challenge）
  if (req.body.challenge) {
    return res.json({ challenge: req.body.challenge });
  }

  // 从事件中提取 chatId，查找对应渠道
  const chatId = req.body.event?.message?.chat_id;
  const channelCode = findChannelCodeByChatId(chatId);

  if (!channelCode) {
    return res.json({ code: 0 }); // 未配置的群，忽略
  }

  const channel = channelFactory.get(channelCode);
  const channelConfig = getChannelConfig(channelCode);

  // 解析消息（非消息事件则忽略）
  const message = await channel.receiveMessage(req.body);
  if (!message) {
    return res.json({ code: 0 });
  }

  // 优先检查是否为交班/接班/草稿指令（指令触发与 messageFilter 独立）
  const command = channel.parseCommand(message);
  if (command) {
    if (command.type === 'HANDOVER_START') {
      await handleHandoverStart(command.sender, channel, message.chatId, channelCode);
    } else if (command.type === 'HANDOVER_ACCEPT') {
      await handleHandoverAccept(command.sender, channel, message.chatId, channelCode);
    } else if (command.type === 'HANDOVER_CANCEL') {
      await handleHandoverCancel(command.sender, channel, message.chatId, channelCode);
    } else if (command.type === 'DRAFT_VIEW') {
      await handleDraftView(command.sender, channel, message.chatId, channelCode);
    }
    res.json({ code: 0 });
    return;
  }

  // 否则作为随手记处理（受群级别消息过滤配置控制）
  if (channelConfig.settings.messageFilter === 'mention' && !message.mentionsBot) {
    res.json({ code: 0 }); // 仅处理 @机器人的消息，当前消息不包含
    return;
  }

  if (message.type === 'text') {
    await handleTextMessage(message, channel, channelCode);
  } else if (message.type === 'image') {
    await handleImageMessage(message, channel, channelCode);
  } else if (message.type === 'audio') {
    await handleAudioMessage(message, channel, channelCode);
  }

  res.json({ code: 0 });
});

// 处理草稿查看指令：@自己 草稿
async function handleDraftView(sender: UserInfo, channel: ChannelAdapter, chatId: string, channelCode: string) {
  const draftPath = `data/channels/${channelCode}/drafts/ongoing.md`;
  const channelDisplayName = getChannelConfig(channelCode).name;

  // 草稿可能不存在（群内还没有消息）
  if (!await fs.exists(draftPath)) {
    await channel.sendMessage(chatId, { type: 'text', text: `${channelDisplayName} 当前没有草稿，发送第一条消息后将自动创建。` });
    return;
  }

  const draft = await fs.readFile(draftPath, 'utf-8');

  // 从草稿 Markdown 中提取原始记录和 LLM 整理预览
  const { rawRecords, llmPreview } = parseDraftSections(draft);

  // 解析草稿中的结构化数据，构建可编辑卡片
  await channel.sendCard(chatId, {
    type: 'interactive',
    config: { update_multi: true },
    elements: [
      { tag: 'markdown', content: `📋 **当前交接草稿 - ${channelDisplayName}**` },
      { tag: 'form', elements: buildEditableForm(llmPreview) },
      { tag: 'collapsible_panel', folded: true, elements: [
        { tag: 'markdown', content: rawRecords }
      ]},
      { tag: 'action', actions: [
        { tag: 'button', text: '保存修改', type: 'primary', value: { action: 'save', channelCode } },
        { tag: 'button', text: '重新整理', type: 'default', value: { action: 'regenerate', channelCode } },
        { tag: 'button', text: '发起交接', type: 'danger', value: { action: 'handover', channelCode },
          confirm: { title: '确认发起交接？', content: '接班人将收到交接通知' } },
      ]},
    ],
  });
}

// 卡片交互回调处理（飞书将卡片操作回调推送到此 URL）
app.post('/webhook/feishu/card', async (req, res) => {
  // 卡片回调同样需要签名验证
  if (!verifyFeishuSignature(req)) {
    return res.status(403).json({ code: -1, msg: '签名验证失败' });
  }
  const action = req.body.event.action;
  const formValue = action.form_value;
  const actionValue = action.value;
  const channelCode = actionValue.channelCode;
  const channel = channelFactory.get(channelCode);

  if (actionValue.action === 'save') {
    await updateDraftFromForm(formValue, channelCode);
    return { toast: { type: 'success', content: '草稿已保存' } };
  }

  if (actionValue.action === 'regenerate') {
    const newDraft = await regenerateDraft(formValue, channelCode);
    return newDraft;
  }

  if (actionValue.action === 'handover') {
    const operator = await channel.getUserInfo(action.operator.open_id);
    await handleHandoverStart(operator, channel, action.chatId, channelCode);
    return { toast: { type: 'success', content: '交接已发起' } };
  }
});

// 处理交班指令：@自己 交班
async function handleHandoverStart(sender: UserInfo, channel: ChannelAdapter, chatId: string, channelCode: string) {
  const channelConfig = getChannelConfig(channelCode);
  const draftPath = `data/channels/${channelCode}/drafts/ongoing.md`;

  // 检查草稿是否存在
  if (!await fs.exists(draftPath)) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前没有草稿内容，无法发起交接。' });
    return;
  }
  const draft = await fs.readFile(draftPath, 'utf-8');

  // 检查是否已有待交接记录（同一群只允许一份）
  const pendingHandover = await findPendingHandover(channelCode);
  if (pendingHandover) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前已有待交接记录，请等待接班人确认或取消后再试。' });
    return;
  }

  // LLM 按模版整理（生成正文部分）
  const llm = llmFactory.getDefault();
  const handoverBody = await llm.generateHandover({
    draft: draft,
    template: await getTemplate(channelCode)
  });

  if (channelConfig.settings.requireAccept) {
    // 模式 A：需要接班确认 → 保存待交接记录，发送卡片等待接班
    await savePendingHandover(channelCode, sender, handoverBody);
    await channel.sendCard(chatId, {
      title: `交班：${sender.name}`,
      content: handoverBody,
      footer: `接班人请回复：@自己 接班`,
    });
  } else {
    // 模式 B：不需要接班确认 → 直接归档
    const monthDir = `data/channels/${channelCode}/handovers/${formatYearMonth()}`;
    await fs.mkdir(monthDir, { recursive: true });
    const filename = `${formatDate()}_${sender.id}_archived.md`;
    const now = new Date().toISOString();
    const handoverRecord = buildHandoverRecord(channelCode, sender, null, handoverBody, { requireAccept: false, createdAt: now });
    await fs.writeFile(`${monthDir}/${filename}`, handoverRecord);
    await clearDraft(channelCode);
    await git.autoCommit(`交接归档: ${channelCode} - ${sender.name}`);
    await channel.sendCard(chatId, {
      title: `交接已归档：${sender.name}`,
      content: handoverBody,
      footer: `交接时间：${new Date().toLocaleString()}`,
    });
  }
}

// 处理接班指令：@自己 接班
async function handleHandoverAccept(receiver: UserInfo, channel: ChannelAdapter, chatId: string, channelCode: string) {
  const channelConfig = getChannelConfig(channelCode);

  if (!channelConfig.settings.requireAccept) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前群不需要接班确认，交班时已自动归档。' });
    return;
  }

  const pendingHandover = await findPendingHandover(channelCode);
  if (!pendingHandover) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前没有待交接的记录。' });
    return;
  }

  // 保存交接记录（含 frontmatter）
  const monthDir = `data/channels/${channelCode}/handovers/${formatYearMonth()}`;
  await fs.mkdir(monthDir, { recursive: true });
  const filename = `${formatDate()}_${pendingHandover.sender.id}_${receiver.id}.md`;
  const now = new Date().toISOString();
  const handoverRecord = buildHandoverRecord(channelCode, pendingHandover.sender, receiver, pendingHandover.content, { requireAccept: true, createdAt: pendingHandover.createdAt, completedAt: now });
  await fs.writeFile(`${monthDir}/${filename}`, handoverRecord);

  // 清空草稿和待交接记录
  await clearDraft(channelCode);
  await removePendingHandover(channelCode);
  await git.autoCommit(`交接完成: ${channelCode} - ${pendingHandover.sender.name} -> ${receiver.name}`);

  // 向群聊推送交接完成确认卡片
  await channel.sendCard(chatId, {
    title: `交接完成：${pendingHandover.sender.name} → ${receiver.name}`,
    content: pendingHandover.content,
    footer: `交接时间：${new Date().toLocaleString()}`,
  });
}

// 处理取消待交接指令：@自己 取消
async function handleHandoverCancel(sender: UserInfo, channel: ChannelAdapter, chatId: string, channelCode: string) {
  const pendingHandover = await findPendingHandover(channelCode);
  if (!pendingHandover) {
    await channel.sendMessage(chatId, { type: 'text', text: '当前没有待交接的记录。' });
    return;
  }

  // 删除待交接记录，草稿保留（可重新发起交班）
  await removePendingHandover(channelCode);
  await git.autoCommit(`取消交接: ${channelCode} - ${sender.name}`);

  await channel.sendMessage(chatId, {
    type: 'text',
    text: `交接已取消（由 ${sender.name} 操作）。草稿内容保留，可重新 @自己 交班。`
  });
}

// 构建交接记录文件（frontmatter + 正文）
function buildHandoverRecord(
  channelCode: string,
  sender: { id: string; name: string },
  receiver: { id: string; name: string } | null,
  body: string,
  meta: { requireAccept: boolean; createdAt: string; completedAt?: string }
): string {
  const channelConfig = getChannelConfig(channelCode);
  const frontmatter = [
    '---',
    `id: hv_${Date.now()}`,
    `channel_code: ${channelCode}`,
    `channel_name: ${channelConfig.name}`,
    `chat_id: ${channelConfig.chatId}`,
    `created_at: ${meta.createdAt}`,
    `sender:`,
    `  name: ${sender.name}`,
    `  channel_user_id: ${sender.id}`,
    `receiver:`,
    `  name: ${receiver?.name ?? ''}`,
    `  channel_user_id: ${receiver?.id ?? ''}`,
    `status: ${meta.requireAccept ? 'completed' : 'archived'}`,
    `require_accept: ${meta.requireAccept}`,
    meta.completedAt ? `completed_at: ${meta.completedAt}` : '',
    '---',
  ].filter(Boolean).join('\n');

  return `${frontmatter}\n\n${body}`;
}

// 辅助函数：从草稿 Markdown 中分离原始记录和 LLM 整理预览
function parseDraftSections(draft: string): { rawRecords: string; llmPreview: string } {
  const sections = draft.split(/^## /m);
  let rawRecords = '';
  let llmPreview = '';
  for (const section of sections) {
    if (section.startsWith('记录内容')) {
      rawRecords = section.replace(/^记录内容\n?/, '').trim();
    } else if (section.startsWith('LLM 整理预览')) {
      llmPreview = section.replace(/^LLM 整理预览\n?/, '').trim();
    }
  }
  return { rawRecords, llmPreview };
}

// 辅助函数：通过 chatId 查找渠道 code
function findChannelCodeByChatId(chatId: string): string | null {
  const config = loadChannelsConfig();
  const channel = config.channels.find(ch => ch.chatId === chatId && ch.isEnabled);
  return channel?.code ?? null;
}

// 飞书签名验证
import * as crypto from 'crypto';

function verifyFeishuSignature(req: Request): boolean {
  const timestamp = req.headers['x-lark-request-timestamp'];
  const nonce = req.headers['x-lark-request-nonce'];
  const signature = req.headers['x-lark-signature'];
  const encryptKey = getFeishuPlatformConfig().encryptKey || getFeishuPlatformConfig().verificationToken;

  if (!timestamp || !nonce || !signature) return false;

  // 防重放攻击：时间戳超过 5 分钟则拒绝
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - Number(timestamp)) > 300) return false;

  const token = encryptKey;
  const body = JSON.stringify(req.body);
  const content = timestamp + nonce + token + body;
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return hash === signature;
}

// 辅助函数
function formatDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
```

### 9.2 LLM 调用策略

**核心决策：每条消息触发 LLM 分析，两级队列控制并发**

**问题**：
- 多人同时发消息 → 同一渠道内并发冲突
- 多渠道同时活跃 → 跨渠道并发总量可能打满 Provider 速率限制（通常 2-5 QPS）

**方案：渠道级保序队列 + 全局并发信号量 + 降级策略**

```
消息到达 → 原文立即写入草稿（不阻塞）
              ↓
         加入渠道级队列（保证同渠道内顺序）
              ↓
         请求全局信号量（跨渠道总并发受控）
              ↓
         ├─ 有配额 → 执行 LLM 调用
         └─ 无配额 → 等待（不丢弃，不阻塞其他渠道）
              ↓
     LLM 返回 → 释放信号量 → 更新草稿整理预览
              ↓
     LLM 失败 → 降级：草稿保留原文，标记"待分析"
```

```typescript
// 两级 LLM 调用队列
class LLMQueue {
  // 渠道级队列：保证同渠道消息按顺序处理
  private channelQueues: Map<string, QueueItem[]> = new Map();
  // 渠道处理标记：防止 drainChannel 并发执行
  private channelProcessing: Map<string, boolean> = new Map();
  // 全局信号量：控制跨渠道总并发
  private globalSemaphore: Semaphore;
  // 配置
  private maxGlobalConcurrency: number;  // 全局最大并发（默认 3，Web 后台可配）
  private maxRetries = 2;
  private retryDelay = 2000;

  constructor(config?: { maxGlobalConcurrency?: number }) {
    this.maxGlobalConcurrency = config?.maxGlobalConcurrency ?? 3;
    this.globalSemaphore = new Semaphore(this.maxGlobalConcurrency);
  }

  // 入队（不阻塞消息接收）
  enqueue(channelCode: string, task: LLMTask): void {
    if (!this.channelQueues.has(channelCode)) {
      this.channelQueues.set(channelCode, []);
    }
    this.channelQueues.get(channelCode)!.push(task);
    this.drainChannel(channelCode);
  }

  // 消费渠道队列（加锁防并发）
  private async drainChannel(channelCode: string): Promise<void> {
    // 防止同一渠道的 drain 并发执行
    if (this.channelProcessing.get(channelCode)) return;
    this.channelProcessing.set(channelCode, true);

    try {
      while (true) {
        const queue = this.channelQueues.get(channelCode);
        if (!queue || queue.length === 0) break;

        const task = queue[0];  // 取队首但不移除（等完成后再移除，保证顺序）
        try {
          await this.globalSemaphore.acquire();  // 等待全局配额
          try {
            queue.shift();  // 开始处理，移除队首
            const result = await this.callWithRetry(task);
            await task.onSuccess(result);
          } finally {
            this.globalSemaphore.release();  // 释放全局配额
          }
        } catch (err) {
          queue.shift();
          await task.onFailure(err);
        }
      }
    } finally {
      this.channelProcessing.set(channelCode, false);
    }
  }

  private async callWithRetry(task: LLMTask): Promise<any> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await task.execute();
      } catch (err) {
        if (attempt === this.maxRetries) throw err;
        await sleep(this.retryDelay * (attempt + 1));
      }
    }
  }

  // 动态调整全局并发数（Web 后台可改）
  setConcurrency(n: number): void {
    this.globalSemaphore.resize(n);
  }

  // 状态查询（Web 后台展示）
  getStatus(): { totalPending: number; activeCalls: number; byChannel: Record<string, number> } {
    let totalPending = 0;
    const byChannel: Record<string, number> = {};
    for (const [code, items] of this.channelQueues) {
      byChannel[code] = items.length;
      totalPending += items.length;
    }
    return { totalPending, activeCalls: this.globalSemaphore.active, byChannel };
  }
}

// 简易信号量
class Semaphore {
  private waiting: (() => void)[] = [];
  constructor(private max: number, public active = 0) {}
  async acquire(): Promise<void> {
    if (this.active < this.max) { this.active++; return; }
    return new Promise(resolve => this.waiting.push(resolve));
  }
  release(): void {
    this.active--;
    if (this.waiting.length > 0) { this.active++; this.waiting.shift()!(); }
  }
  resize(n: number): void {
    const diff = n - this.max;
    this.max = n;
    for (let i = 0; i < diff && this.waiting.length > 0; i++) {
      this.active++; this.waiting.shift()!();
    }
  }
}

// 全局队列实例
const llmQueue = new LLMQueue({ maxGlobalConcurrency: 3 });

// 处理文本消息
async function handleTextMessage(message: Message, channel: ChannelAdapter, channelCode: string) {
  // 1. 原文立即写入草稿（不等待 LLM）
  await appendToDraft(channelCode, {
    messageId: message.id,
    type: 'text',
    sender: message.sender,
    rawContent: message.content.text,
    analysis: null,
    status: 'pending_analysis',
    timestamp: new Date()
  });

  // 2. LLM 分析入队
  llmQueue.enqueue(channelCode, {
    execute: () => llmFactory.getDefault().analyzeText({
      text: message.content.text,
      prompt: '请分析这段酒店工作记录，提取关键信息：类别、紧急程度、是否需要接班人关注'
    }),
    onSuccess: (analysis) => updateDraftAnalysis(channelCode, message.id, analysis),
    onFailure: (err) => { logger.error(`LLM 分析失败: ${err.message}`); }
  });
}

// 处理图片消息
async function handleImageMessage(message: Message, channel: ChannelAdapter, channelCode: string) {
  // 保存图片到本地
  const imageDir = `data/channels/${channelCode}/media/images`;
  await fs.mkdir(imageDir, { recursive: true });
  const imagePath = `${imageDir}/${message.id}.jpg`;
  await fs.writeFile(imagePath, message.content.data);

  // 原文写入草稿（标记为图片）
  await appendToDraft(channelCode, {
    messageId: message.id,
    type: 'image',
    sender: message.sender,
    rawContent: `[图片: ${imagePath}]`,
    analysis: null,
    status: 'pending_analysis',
    timestamp: new Date()
  });

  // LLM 多模态分析入队
  llmQueue.enqueue(channelCode, {
    execute: () => llmFactory.getDefault().analyzeImage({
      imagePath,
      prompt: '请识别这张图片中的酒店工作相关信息'
    }),
    onSuccess: (analysis) => updateDraftAnalysis(channelCode, message.id, analysis),
    onFailure: (err) => { logger.error(`LLM 图片分析失败: ${err.message}`); }
  });
}

// 处理语音消息
async function handleAudioMessage(message: Message, channel: ChannelAdapter, channelCode: string) {
  // 保存语音到本地
  const audioDir = `data/channels/${channelCode}/media/audio`;
  await fs.mkdir(audioDir, { recursive: true });
  const audioPath = `${audioDir}/${message.id}.opus`;
  await fs.writeFile(audioPath, message.content.data);

  // 原文写入草稿（标记为语音）
  await appendToDraft(channelCode, {
    messageId: message.id,
    type: 'audio',
    sender: message.sender,
    rawContent: `[语音: ${audioPath}]`,
    analysis: null,
    status: 'pending_analysis',
    timestamp: new Date()
  });

  // LLM 语音转文字入队
  llmQueue.enqueue(channelCode, {
    execute: () => llmFactory.getDefault().transcribeAudio({
      audioPath,
      prompt: '请将这段语音转写为文字'
    }),
    onSuccess: (transcription) => updateDraftAnalysis(channelCode, message.id, {
      category: '语音记录',
      content: transcription,
      urgency: 'normal'
    }),
    onFailure: (err) => { logger.error(`LLM 语音转写失败: ${err.message}`); }
  });
}
```

**降级与容错**：
- 原文**立即**写入草稿，LLM 分析异步补充
- LLM 失败时草稿保留原文 + "待分析"标记，不阻塞流程
- 指数退避重试（2 次），避免持续冲击 API
- 渠道内保序（同群消息不乱序），跨渠道限并发（不超 Provider 限制）
- 全局并发数 Web 后台可调（默认 3，适配不同 Provider 限制）
- Web 后台显示队列状态（各渠道积压数、当前活跃调用数）

**对"实时性"的影响**：
- 单渠道活跃：几乎实时（全局配额充足）
- 3 渠道同时活跃：每渠道仍有 1 并发，体感无延迟
- 5+ 渠道同时活跃：部分渠道需等全局配额释放，延迟数秒
- 极端场景：积压但不会丢失，草稿原文始终在

### 9.3 Markdown 文件操作

```javascript
// 追加到群的草稿（群级别，非个人）
async function appendToDraft(channelCode, record) {
  const draftDir = `data/channels/${channelCode}/drafts`;
  const draftPath = `${draftDir}/ongoing.md`;

  // 如果草稿不存在，自动创建
  if (!await fs.exists(draftPath)) {
    await createDraft(channelCode);
  }

  // 读取现有草稿
  let draft = await fs.readFile(draftPath, 'utf-8');

  // 追加记录（含消息 ID 标记，供 LLM 分析完成后定位更新）
  const recordLine = `<!-- msg:${record.messageId} -->- ${formatTime(record.timestamp)} ${record.sender.name}: ${record.rawContent}\n`;
  draft += recordLine;

  // 写回文件
  await fs.writeFile(draftPath, draft);

  // 更新 LLM 整理预览（异步，不阻塞）
  updateDraftPreview(channelCode).catch(console.error);

  // Git 静默提交
  await git.autoCommit(`随手记: ${channelCode} - ${record.sender.name}`);
}

// LLM 分析完成后更新草稿中的分析结果
async function updateDraftAnalysis(channelCode: string, messageId: string, analysis: any) {
  const draftPath = `data/channels/${channelCode}/drafts/ongoing.md`;
  if (!await fs.exists(draftPath)) return;

  let draft = await fs.readFile(draftPath, 'utf-8');

  // 将对应记录的 status 从 pending_analysis 更新为 analyzed，追加分析结果
  const marker = `<!-- msg:${messageId} -->`;
  if (draft.includes(marker)) {
    draft = draft.replace(
      `${marker}pending_analysis`,
      `${marker}analyzed\n  > 分析: ${analysis.category} | ${analysis.content}`
    );
  } else {
    // 无 marker 时追加到 LLM 整理预览区
    const previewSection = '## LLM 整理预览';
    const previewEntry = `- [${analysis.category}] ${analysis.content}`;
    if (draft.includes(previewSection)) {
      draft = draft.replace(previewSection, `${previewSection}\n${previewEntry}`);
    } else {
      draft += `\n${previewSection}\n${previewEntry}\n`;
    }
  }

  await fs.writeFile(draftPath, draft);
}

// 重新生成草稿的 LLM 整理预览（草稿编辑后触发）
async function updateDraftPreview(channelCode: string) {
  const draftPath = `data/channels/${channelCode}/drafts/ongoing.md`;
  if (!await fs.exists(draftPath)) return;

  const draft = await fs.readFile(draftPath, 'utf-8');
  // 提取所有原始记录内容
  const rawRecords = draft.split('\n').filter(l => l.startsWith('- ')).join('\n');

  if (rawRecords.trim()) {
    llmQueue.enqueue(channelCode, {
      execute: () => llmFactory.getDefault().analyzeText({
        text: rawRecords,
        prompt: '请将以下酒店工作记录整理归类，按交接需要重新组织'
      }),
      onSuccess: async (analysis) => {
        // 替换 LLM 整理预览区
        let updated = await fs.readFile(draftPath, 'utf-8');
        const previewStart = updated.indexOf('## LLM 整理预览');
        if (previewStart !== -1) {
          updated = updated.substring(0, previewStart) + `## LLM 整理预览\n${analysis}\n`;
        } else {
          updated += `\n## LLM 整理预览\n${analysis}\n`;
        }
        await fs.writeFile(draftPath, updated);
      },
      onFailure: (err) => { logger.error(`草稿预览更新失败: ${err.message}`); }
    });
  }
}

// 创建新草稿
async function createDraft(channelCode) {
  const draftDir = `data/channels/${channelCode}/drafts`;
  await fs.mkdir(draftDir, { recursive: true });

  const now = new Date().toISOString();
  const channelConfig = getChannelConfig(channelCode);
  const channelDisplayName = channelConfig.name;
  const content = `---\nchannel_code: ${channelCode}\nchannel_name: ${channelDisplayName}\nstarted_at: ${now}\nupdated_at: ${now}\n---\n\n# ${channelDisplayName} - 当前交接草稿\n\n## 记录内容\n\n## LLM 整理预览\n`;
  await fs.writeFile(`${draftDir}/ongoing.md`, content);
}

// 清空草稿（交接完成后）
async function clearDraft(channelCode) {
  const draftPath = `data/channels/${channelCode}/drafts/ongoing.md`;
  if (await fs.exists(draftPath)) {
    await fs.unlink(draftPath);  // 删除草稿文件，新消息到来时自动创建新草稿
  }
}

// 查找待交接记录
async function findPendingHandover(channelCode: string): Promise<PendingHandover | null> {
  const pendingPath = `data/channels/${channelCode}/drafts/pending.json`;
  if (!await fs.exists(pendingPath)) return null;
  const data = await fs.readFile(pendingPath, 'utf-8');
  return JSON.parse(data);
}

// 保存待交接记录
async function savePendingHandover(channelCode: string, sender: UserInfo, content: string) {
  const pendingPath = `data/channels/${channelCode}/drafts/pending.json`;
  const data = {
    channelCode,
    sender: { id: sender.id, name: sender.name },
    content,
    createdAt: new Date().toISOString()
  };
  await fs.writeFile(pendingPath, JSON.stringify(data, null, 2));
}

// 删除待交接记录（接班确认后或取消后）
async function removePendingHandover(channelCode: string) {
  const pendingPath = `data/channels/${channelCode}/drafts/pending.json`;
  if (await fs.exists(pendingPath)) {
    await fs.unlink(pendingPath);
  }
}
```

### 9.4 （已合并到 9.1 的交班/接班指令处理）

### 9.5 Git 版本控制

```typescript
// Git 操作封装
class GitManager {
  private repo: SimpleGit;

  constructor(dataPath: string) {
    this.repo = simpleGit(dataPath);
  }

  // 初始化仓库
  async init(): Promise<void> {
    if (!await this.repo.checkIsRepo()) {
      await this.repo.init();
      await this.repo.addConfig('user.name', 'All Your Handover');
      await this.repo.addConfig('user.email', 'bot@allyourhandover.com');
    }
  }

  // 自动提交（防抖：30 秒内合并多次写入为一次提交）
  private commitTimer: NodeJS.Timeout | null = null;
  private pendingMessages: string[] = [];

  async autoCommit(message: string): Promise<void> {
    this.pendingMessages.push(message);
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(async () => {
      await this.repo.add('.');
      const msg = this.pendingMessages.length === 1
        ? this.pendingMessages[0]
        : `${this.pendingMessages[0]} 等 ${this.pendingMessages.length} 条操作`;
      await this.repo.commit(msg);
      this.pendingMessages = [];
      this.commitTimer = null;
    }, 30000); // 30 秒防抖
  }

  // 后续迭代：查看历史版本
  async getHistory(filepath: string): Promise<LogResult> {
    return await this.repo.log(['--', filepath]);
  }

  // 后续迭代：回滚到指定版本
  async rollback(filepath: string, commitHash: string): Promise<void> {
    await this.repo.checkout(['-f', commitHash, '--', filepath]);
  }
}
```

---

## 十、迭代计划

### Phase 1（MVP）
- [ ] 飞书自建应用 + Bot 注册与消息订阅（含 Webhook URL 配置）
- [ ] 群聊指令交互（@自己 交班/接班/取消/草稿）
- [ ] 多群支持（群级别数据隔离与配置）
- [ ] LLM 每条消息实时调用 + 群级草稿自动整理
- [ ] 草稿查看编辑（消息卡片内表单，@自己 草稿 触发）
- [ ] 交接内容消息卡片展示（支持 requireAccept 两种模式）
- [ ] 交接完成后推送确认卡片
- [ ] 群级别配置（是否需要接班确认、消息过滤模式）
- [ ] 图片/语音本地存储 + LLM 多模态处理
- [ ] Web 管理后台（纯 HTML + 原生 JS）
  - LLM Provider 设置（添加/切换/测试）
  - 渠道设置（飞书应用配置、群管理）
  - 模版编辑（渠道级别，自由 Markdown 模版）
  - 历史查询（按日期/关键词/参与者筛选）
  - 运行监控（LLM 调用统计、错误日志）
- [ ] Git 默认开启，静默自动提交
- [ ] 单可执行文件打包（pkg / nexe，Linux + Windows）
- [ ] 系统服务注册（`install` 命令，systemd / Windows Service）
- [ ] Web 初始化向导（首次运行引导配置）

### Phase 2
- [ ] 多 LLM Provider 支持（Phase 1 支持 OpenAI/DeepSeek/Moonshot）
- [ ] 企业微信渠道适配
- [ ] 钉钉渠道适配
- [ ] H5 侧边栏编辑页面（复杂编辑场景，如长文本、富文本）
- [ ] 数据导出（PDF/Word）
- [ ] Git 历史版本查看界面
- [ ] SQLite 索引层（加速历史查询）

### Phase 3
- [ ] 模版高级编辑器（可视化拖拽等）
- [ ] 移动端优化
- [ ] API 开放

---

## 十一、已确认决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 目标客户 | 单店酒店 |
| 2 | 部署方式 | 客户自己部署（单可执行文件优先，Docker 备选）|
| 3 | 数据存储 | 纯 Markdown 文件（类似 Obsidian）|
| 4 | 程序形态 | 本地 Web 服务 |
| 5 | 渠道支持 | 多渠道适配（飞书 Phase 1，企微/钉钉 Phase 2）|
| 6 | LLM 配置 | Web 后台管理，支持多 Provider |
| 7 | 员工识别 | 渠道昵称/姓名 |
| 8 | 交班触发 | **群聊指令交互**（@自己 交班/接班），不用审批流 |
| 9 | 随手记 | 自动整理群聊消息，**LLM 每条实时调用** |
| 10 | 历史查询 | 员工翻群消息卡片，管理员访问 Web 后台 |
| 11 | Git 版本控制 | **默认开启**，静默自动提交，无需配置 |
| 12 | 备份恢复 | 不需要（用户自己备份文件夹）|
| 13 | 多酒店 | 多酒店多实例（一个实例只服务一个酒店）|
| 14 | 产品定位 | 简化版的、面向交班场景的小龙虾。英文名 **All Your Handover** |
| 15 | 技术栈 | **TypeScript + Node.js**（参考小龙虾架构）|
| 16 | Web 后台鉴权 | **无登录校验**，依赖 OS 鉴权（能访问服务器即管理员）|
| 17 | 收费模式 | **暂不考虑**，先做产品 |
| 18 | 草稿查看编辑 | **消息卡片内表单编辑**（@自己 草稿 触发），Phase 2 备选 H5 侧边栏 |
| 19 | 指令触发 | **@自己 + 关键词**（交班/接班/取消/草稿），不是 @机器人 |
| 20 | 多群支持 | **从一开始支持多群**，一个实例可服务多个群 |
| 21 | 接班确认 | **任何人接都行**，不指定接班人 |
| 22 | 拒绝流程 | **不需要**，不满意在群里沟通后重新交班 |
| 23 | 草稿模型 | **群级别草稿**，不是个人草稿；一个群一个草稿 |
| 24 | 草稿创建 | **第一条消息自动创建**，无需显式指令 |
| 25 | 接班确认配置 | **群级别可配置**（Web 后台设置是否需要接班确认）|
| 26 | 交接归档 | 需要接班确认时：接班后归档；不需要时：交班直接归档 |
| 27 | 并发交接 | **同一群只允许一份待交接草稿** |
| 28 | 媒体存储 | **本地文件存储**（图片/语音保存到 data/channels/{code}/media/）|
| 29 | 班次概念 | **无班次概念**，不标注早班/中班 |
| 30 | Web 后台范围 | Phase 1 包含：LLM 配置、渠道配置、模版编辑、历史查询、运行监控 |
| 31 | 飞书应用类型 | **自建应用 + Bot**（双向通信）|
| 32 | 群配置方式 | **Web 后台配置**（是否需要接班、消息过滤模式等）|
| 33 | 消息过滤 | **群级别配置**（all: 处理所有消息 / mention: 仅处理 @机器人的消息）|
| 34 | 文件命名 | **英文+数字+下划线**（渠道 code 命名目录，name 仅显示）|
| 35 | 草稿清空策略 | 交接完成后清空草稿，新消息自动创建新草稿 |
| 36 | 模版格式 | **自由 Markdown 模版**，LLM 理解结构后填写 |
| 37 | Web 前端技术 | **纯 HTML + 原生 JS**（最轻量，无需构建工具）|
| 38 | 渠道标识 | **code**（仅英文+数字+下划线），用于文件/目录命名；`name` 仅显示用 |
| 40 | 部署策略 | **单可执行文件**（零依赖）优先，Docker 备选；支持 Linux + Windows |
| 41 | 配置方式 | **所有配置通过 Web 页面**，避免命令行和手动编辑配置文件 |
| 42 | 安装体验 | 下载→运行→Web 向导配置→使用，**无需操作配置文件** |
| 43 | 系统服务 | **默认注册**为系统服务（Linux systemd / Windows Service），开机自启 |
| 44 | 卡片预览回复 | **默认关闭**，用户需查看时 @自己 草稿 |
| 45 | SQLite 索引 | **Phase 2**，MVP 不引入 |
| 46 | 交接模版级别 | **渠道级**，不同群可用不同模版 |
| 47 | 系统服务注册 | **默认自动注册**，无需手动 install |
| 48 | 项目命名 | **All Your Handover**（一语双关：数据归你 + 极客梗），中文暂不定 |
| 49 | LLM 并发控制 | **两级队列**：渠道内保序 + 全局信号量限并发（默认 3，Web 后台可调）|
| 50 | 取消待交接 | **@自己 取消**，任何人可取消，草稿保留可重新交班 |
| 51 | 平台凭证归属 | **平台级共享**（appId/appSecret/verificationToken 放 platforms 而非每个渠道重复）|
| 52 | Webhook 路由 | **单一端点 `/webhook/feishu`**，按 chatId 路由到对应渠道 |

## 十二、待确认问题

> **所有问题已确认，无遗留待决事项。文档已进入开发就绪状态。**

| # | 问题 | 状态 | 结论 |
|---|------|------|------|
| 1 | ~~飞书审批流如何加载草稿内容~~ | ✅ 已解决 | 不用审批流 |
| 2 | ~~LLM 调用时机~~ | ✅ 已解决 | 每条消息实时调用 |
| 3 | ~~定价与本地部署兼容~~ | ✅ 已解决 | 暂不考虑收费 |
| 4 | ~~员工如何查看历史~~ | ✅ 已解决 | 翻群消息卡片 |
| 5 | ~~管理员如何认证~~ | ✅ 已解决 | 无登录，依赖 OS 鉴权 |
| 6 | ~~技术栈选择~~ | ✅ 已解决 | TypeScript + Node.js |
| 7 | ~~交班触发方式~~ | ✅ 已解决 | 群聊 @自己 交班/接班 |
| 8 | ~~交接过程中交班人能否修改草稿~~ | ✅ 已解决 | 消息卡片内编辑 |
| 9 | ~~指令中"@自己"指谁~~ | ✅ 已解决 | 用户 @自己 + 关键词 |
| 10 | ~~是否支持多群~~ | ✅ 已解决 | 从一开始支持多群 |
| 11 | ~~接班人如何确定~~ | ✅ 已解决 | 任何人接都行 |
| 12 | ~~是否需要拒绝流程~~ | ✅ 已解决 | 不需要 |
| 13 | ~~草稿是个人级还是群级别~~ | ✅ 已解决 | 群级别，一个群一个草稿 |
| 14 | ~~草稿何时创建~~ | ✅ 已解决 | 第一条消息自动创建 |
| 15 | ~~接班确认是否必须~~ | ✅ 已解决 | 群级别可配置 |
| 16 | ~~交接归档时机~~ | ✅ 已解决 | 需要接班→接班后归档；不需要→交班直接归档 |
| 17 | ~~并发交接处理~~ | ✅ 已解决 | 同一群只允许一份待交接 |
| 18 | ~~媒体文件存储~~ | ✅ 已解决 | 本地文件存储 |
| 19 | ~~是否有班次概念~~ | ✅ 已解决 | 无班次概念 |
| 20 | ~~消息过滤模式~~ | ✅ 已解决 | 群级别配置（all/mention）|
| 21 | ~~多群配置文件~~ | ✅ 已解决 | 合并在一个 channels.json |
| 22 | ~~Web 前端技术~~ | ✅ 已解决 | 纯 HTML + 原生 JS |
| 23 | ~~模版格式~~ | ✅ 已解决 | 自由 Markdown 模版 |
| 24 | ~~飞书应用类型~~ | ✅ 已解决 | 自建应用 + Bot |
| 25 | ~~文件命名方式~~ | ✅ 已解决 | 全链路英文+数字+下划线，渠道用 code 命名 |

---

## 十三、设计缺陷和待补充

### ~~缺陷 1：飞书审批流与草稿内容的矛盾~~ **已解决：改用群聊指令交互**

不再使用审批流，改为群聊内"@自己 交班/接班"指令交互，彻底规避审批表单限制。

### ~~缺陷 2：草稿的归属和并发~~ **已解决：改为群级别草稿**

草稿改为群级别（`ongoing.md`），一个群一个草稿。同一群同一时间只允许一份待交接草稿。交接完成后草稿清空，新消息自动创建新草稿。

### ~~缺陷 3：管理员认证机制~~ **已解决：无登录，依赖 OS 鉴权**

Web 后台不设登录，能访问服务器即视为管理员。

### ~~缺陷 4：本地部署的订阅制~~ **已解决：暂不考虑收费**

### ~~缺陷 5：LLM 调用成本控制~~ **已解决：每条消息实时调用**

用户确认每条消息实时调 LLM。LLM 失败时不阻塞，保留原文。

### ~~缺陷 6：错误处理和边界情况~~ **已解决**

**实现细节**：
- 飞书/LLM API 限流：指数退避重试 + 告警
- LLM API 失败：不阻塞流程，草稿保留原文；未配置 LLM Provider 时使用原文兜底
- 草稿并发写入：进程内 Mutex（Promise 锁），适用于单进程部署场景；多进程部署需额外同步机制
- 程序崩溃恢复：启动时检查草稿完整性，自动修复
- 两个人同时交班：第二个人收到提示"当前已有待交接记录"，需等前一次交接完成或通过"@自己 取消"取消
- 签名验证使用 `crypto.timingSafeEqual`（防时序攻击）+ 5 分钟防重放 + 配置缓存 30 秒
- Markdown 草稿净化防止注入，frontmatter 值 YAML 安全引号包裹

### ~~缺陷 7：初始化流程~~ **已解决：Web 向导 3 步初始化**

**补充首次部署步骤**：
1. 下载并运行单可执行文件（或 `docker run`）
2. 程序自动初始化数据目录、注册系统服务
3. 浏览器访问 `http://localhost:3000` → 进入初始化向导
4. 配置 LLM Provider（选 Provider、填 API Key、选模型）
5. 配置飞书应用（App ID/Secret/VerificationToken，平台级共享）
6. 添加渠道（code + 名称 + 群 Chat ID + 是否需要接班确认 + 消息过滤模式）
7. 编辑交接模版（默认模版可改）
8. 完成，开始使用

---

## 十四、附录：与 SaaS 版本对比

| 特性 | SaaS 版本 | Lite 版本 |
|------|----------|-----------|
| 数据存储 | PostgreSQL | Markdown 文件 + 本地媒体 |
| 员工管理 | 需要预设员工表 | 无需预设，渠道昵称识别 |
| 班次管理 | 需要配置班次 | 无需班次概念 |
| 草稿模型 | 个人级草稿 | **群级别草稿**，一个群一个草稿 |
| 交班确认 | 状态机流转 | 群聊指令（@自己 接班），**群级别可配置** |
| 渠道 | 仅微信小程序 | 飞书/企微/钉钉（可扩展），**多群支持** |
| LLM 配置 | 代码级配置 | Web 后台管理 |
| LLM 调用 | 创建时调用 | 每条消息实时调用 |
| 历史查询 | Web 界面（需登录）| 群消息卡片 + Web（管理员，无登录）|
| Web 后台 | 复杂后台（Vue 3 + Element Plus）| **纯 HTML + 原生 JS**，轻量级 |
| 部署 | 云端 SaaS | **单可执行文件**（零依赖）或 Docker |
| 渠道标识 | UUID | **code**（英文+数字，可读+稳定）|
| 数据所有权 | 厂商持有 | 客户自有 |
| 配置复杂度 | 高 | 低 |
| 拒绝流程 | 有 | **无**，不满意重新交班 |
| 交接模版 | 全局模版 | **渠道级模版**，不同群可用不同模版 |
| 消息过滤 | 无 | **群级别可配置**（all/mention）|

---

## 更新历史

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-04-17 | v0.1 | 访谈整理，初版设计文档 |
| 2026-04-17 | v0.2 | 架构升级：多渠道适配层、LLM Provider Web 管理、小龙虾定位 |
| 2026-04-17 | v0.3 | 设计审查：补充缺陷分析（审批流矛盾、草稿归属、管理员认证、订阅制、LLM 成本）、修复章节编号、补充目录结构和初始化流程 |
| 2026-04-17 | v0.3.1 | 交接完成后向群聊推送消息卡片，展示完整交接内容 |
| 2026-04-17 | v0.4 | 6项重大决策落地：①去掉审批流改群聊指令交互 ②LLM每条实时调用 ③Web后台无登录鉴权 ④员工翻群消息查历史 ⑤技术栈定TypeScript+Node.js ⑥删除订阅制定价 |
| 2026-04-17 | v0.5 | 调研草稿编辑方案：采用消息卡片内表单编辑（@自己 草稿 触发），新增 DRAFT_VIEW 指令和卡片交互回调处理，Phase 2 备选 H5 侧边栏 |
| 2026-04-17 | v1.0 | 最终访谈确认，开发就绪：草稿改为群级别、多群从一开始支持、任何人可接班、无拒绝流程、群级别可配置（requireAccept/messageFilter）、无班次概念、纯HTML前端、媒体本地存储、自由Markdown模版、中文文件命名 |
| 2026-04-17 | v1.1 | 渠道改用 code（英文+数字）标识和文件命名；部署改为单可执行文件零依赖（优先于 Docker），支持 Linux+Windows；所有配置通过 Web 页面完成，避免命令行和配置文件操作 |
| 2026-04-17 | v1.2 | 全面审计修复：架构图数据层更新、ChannelFactory改用code、模版getTemplate传入channelCode、文件命名改用sender.id、修复messageFilter语义（mention=@机器人）、pendingHandover持久化、飞书签名验证、API Key加密方式、Git防抖提交、clearDraft删除而非清空、系统服务权限说明、FeishuAdapter获取真实姓名、删除重复决策、修复矛盾描述 |
| 2026-04-17 | v1.3 | 第二轮审计修复：①parseCommand改用senderId∈mentionList精准匹配 ②drainChannel加channelProcessing锁防竞态 ③交接文件路径补齐月份子目录 ④卡片回调参数修正 ⑤message.type字段统一 ⑥草稿存在性检查 ⑦FeishuAdapter补充code/botOpenId/用户缓存 ⑧定义Message接口 ⑨定义pending.json结构 ⑩新增HANDOVER_CANCEL指令 ⑪补全handleAudioMessage/handleImageMessage ⑫补全updateDraftAnalysis/updateDraftPreview ⑬补全pendingHandover操作函数 ⑭新增Web管理API全规格 ⑮飞书全量接收模式+Webhook URL配置说明 ⑯目录树文件名用ID ⑰路由参数统一channelCode ⑲平台凭证抽至platforms层共享 ⑳Webhook单一端点按chatId路由 ㉑channel.json改为运行时状态 ㉒buildHandoverRecord统一构建frontmatter ㉓parseDraftSections分离草稿区段 ㉔飞书签名验证实现 ㉕appendToDraft含messageId标记 |
| 2026-04-18 | v1.4 | 实现审查与文档同步：①新增 .encryption-key 文件到目录树和安全说明 ②API Key 加密格式(iv:authTag:ciphertext)文档化 ③API 端点方法修正(POST→PUT for toggle/default/reset) ④交接详情API路径加 :month 段 ⑤历史查询参数名修正(startDate/endDate+分页) ⑥新增 GET /health 健康检查端点 ⑦安全措施补全(timingSafeEqual、Markdown净化、YAML安全引号、路径遍历防护、API Key掩码、请求体大小限制) ⑧文件锁改用进程内Mutex(非proper-lockfile) ⑨交接记录ID改UUID ⑩模版格式改{{placeholder}}占位符 ⑪缺陷6标记已解决 ⑫缺陷7标记已解决 ⑬飞书签名算法修正(SHA256+encryptKey+body,非仅token) ⑭新增encryptKey到FeishuPlatformConfig ⑮可选ADMIN_TOKEN鉴权 ⑯加密密钥文件权限0o600 ⑰Shell注入防护(service.ts写入文件替代管道) ⑱前端XSS防护(esc()转义) ⑲LLM队列监控接入真实数据 ⑳移除未用依赖(dotenv/proper-lockfile) ㉑GitManager错误处理 ㉒parseCommand改用mentionsBot检测 ㉓channelCode验证防路径遍历 |