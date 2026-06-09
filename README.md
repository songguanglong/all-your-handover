# All Your Handover

轻量级本地部署的酒店交接班工具 — 数据自有，交接由你做主

## 一句话介绍

把飞书群聊变成交接班系统：员工在群里发消息，AI 自动整理成交接记录，H5 页面一键交班/接班。

**数据全部存在你电脑上**，不用联网数据库，换个电脑把文件夹拷走就行。

---

## 快速开始（Windows，5 分钟）

> 如果你用的是 Linux 或 Mac，或者希望用 Docker 部署，请看下面的"其他部署方式"。

### 第一步：下载程序

去 [GitHub Releases](https://github.com/songguanglong/all-your-handover/releases) 下载最新版的 `all-your-handover-win.zip`，解压到任意文件夹。

### 第二步：启动

双击 `all-your-handover.exe`，看到命令行窗口显示 `服务已启动，端口 3000` 即可。

> 第一次启动会自动创建数据文件夹 `data/`，里面存着所有配置和交接记录。

### 第三步：打开管理后台

浏览器访问 `http://localhost:3000/admin`

1. **添加 LLM**（AI 服务）：填 DeepSeek / OpenAI / Moonshot 的 API Key，选一个默认模型
2. **添加渠道**（飞书群）：填飞书群的 chatId 和群名称
3. **去飞书开放平台** 把 Webhook 地址 `http://你的服务器IP:3000/webhook/feishu` 配好

完事。群里发 `@自己 交班` 就能用了。

### 常用操作

| 操作 | 怎么做 |
|------|--------|
| 开机自动启动 | 双击 `install-service.bat`（以管理员身份运行），之后服务随 Windows 自动启动 |
| 停止服务 | `nssm stop AllYourHandover` |
| 重启服务 | `nssm restart AllYourHandover` |
| 卸载服务 | 双击 `uninstall-service.bat` |
| 备份数据 | 把 `data/` 文件夹复制一份就行 |
| 改端口 | 编辑同目录下的 `.env.win` 文件，改 `PORT=3000` 那一行 |

---

## 其他部署方式

### 方式二：Docker（推荐，如果你有人懂 Docker）

```bash
git clone https://github.com/songguanglong/all-your-handover.git
cd all-your-handover
docker compose up -d
```

数据存在 `./data`，端口 3000。就这两条命令。

### 方式三：源码运行（开发者用）

需要安装 Node.js 18+。

```bash
git clone https://github.com/songguanglong/all-your-handover.git
cd all-your-handover
npm install
npm run build
npm start
```

---

## 飞书配置

1. 登录 [飞书开放平台](https://open.feishu.cn/)，创建"企业自建应用"
2. 添加"机器人"能力
3. 事件订阅 URL 填：`https://你的服务器IP:3000/webhook/feishu`
4. 订阅事件选：`im.message.receive_v1`
5. 开启"接收群聊中所有消息"
6. 把 App ID 和 App Secret 填到管理后台的"平台配置"里

---

## 功能特性

### 交接班流程
- 群聊消息实时记录，AI 自动分析分类
- 草稿实时预览，支持 H5 页面编辑
- 两种交接模式：需接班人确认 / 交班人自行确认
- 消息撤回自动标记，交接归档后草稿自动清理

### Agent 智能系统
- **灵魂设定**：可配置人设、场景、约束和语气（内置酒店/工厂/医院模板）
- **行为规则**：优先级判断、组织规范、禁忌
- **经验学习**：用户编辑交接记录时，自动推断编辑意图并积累规则
- **渠道记忆**：纠错记录和禁忌自动注入 LLM，越用越准
- **梦境反思**：交接后自动反思，检测高修改率则生成候选记忆

### 管理后台
- LLM Provider 配置（OpenAI / DeepSeek / Moonshot，支持按任务路由）
- 渠道管理（多群支持，一键开关）
- 模板编辑 + 系统 Prompt 访谈式设计
- Agent 灵魂 / 经验 / 梦境配置
- 历史记录查询

### H5 移动端
- 飞书 OAuth 认证
- 草稿查看与编辑
- 一键交班 / 接班 / 打回

---

## 数据与备份

所有数据存在 `data/` 文件夹里：

```
data/
├── config/
│   ├── channels.json          # 渠道配置
│   ├── llm-providers.json     # LLM Provider 配置（API Key 加密存储）
│   └── .encryption-key         # 加密密钥（自动生成）
├── channels/<code>/
│   ├── drafts/                 # 草稿数据
│   │   ├── raw.jsonl           # 原始消息记录
│   │   ├── analysis.json        # LLM 分析结果
│   │   ├── preview.md           # 交接预览
│   │   └── preview-items.json   # 条目跟踪
│   ├── handovers/YYYY-MM/       # 交接记录归档
│   ├── soul.md                 # 灵魂人设
│   ├── agents.md               # 行为规则
│   ├── experience.json         # 经验规则
│   ├── channel-memory.md        # 渠道记忆
│   ├── template.md             # 交接模板
│   └── system-prompt.txt        # 系统 Prompt
└── logs/app.log
```

**备份**：直接把 `data/` 文件夹复制一份就行。系统内置 Git 自动提交，所有修改都有版本记录。

---

## 安全提醒

- 生产环境必须设置 `ADMIN_TOKEN` 环境变量，否则管理后台无密码保护
- 如需跨设备迁移，请设置 `ENCRYPTION_KEY` 环境变量，否则换机器后加密的 API Key 无法解密

---

## 访问地址

| 页面 | 地址 | 说明 |
|------|------|------|
| 管理后台 | `http://localhost:3000/admin` | Web 后台管理 |
| H5 移动端 | `http://localhost:3000/h5?code={渠道code}` | 草稿查看/编辑/交班，需携带渠道参数 |
| 健康检查 | `http://localhost:3000/health` | 服务状态 |

---

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 开发模式（热重载）
npm run build        # 编译 TypeScript
npm test             # 运行测试
npm run lint         # ESLint 检查
```

打包独立可执行文件：

```bash
npm run build
npm run pkg          # 输出到 dist/all-your-handover.exe 和 dist/all-your-handover-linux
```

---

## 文档

- [架构范式](PARADIGM.md) — 代码架构说明
- [业务流流程图](docs/FLOWS.md) — 数据流可视化
- [开发指南](CLAUDE.md) — AI 协作者编码规范
- [编码规则](docs/AI_RULES.md) — 项目内部规范

## License

All rights reserved.
