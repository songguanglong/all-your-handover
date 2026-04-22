# All Your Handover

轻量级本地部署的酒店交接班工具 — 数据自有，交接由你做主

## 核心理念

- **数据自有**：所有数据存储在客户本地，Markdown/JSON 文件格式
- **一键部署**：Docker 部署或源码运行，零数据库依赖
- **零配置启动**：无需预设员工表、班次表，开箱即用
- **群聊交互**：飞书群聊即入口，`@自己 交班` 即可发起
- **Agent 智能系统**：可设定人设、积累经验、自我进化

## 功能特性

### 交接班流程
- 群聊消息实时记录，LLM 自动分析分类
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

## 安装部署

### 访问地址

| 页面 | 地址 | 说明 |
|------|------|------|
| 管理后台 | `http://localhost:3000/admin` | Web 后台管理 |
| H5 移动端 | `http://localhost:3000/h5?code={渠道code}` | 草稿查看/编辑/交班，需携带渠道参数 |
| 健康检查 | `http://localhost:3000/health` | 服务状态 |

### 方式一：Docker 部署（推荐）

```bash
# 1. 克隆仓库
git clone https://gitee.com/songguanglong/all-your-handover.git
cd all-your-handover

# 2. 构建并启动
docker compose up -d

# 3. 查看日志
docker compose logs -f
```

服务启动后访问 `http://localhost:3000/admin` 进入管理后台。

**配置说明**：
- 数据目录挂载到宿主机 `./data`，容器重启不丢失数据
- 端口默认 3000，可在 `docker-compose.yml` 中修改
- 首次启动自动创建目录结构和默认配置文件

**环境变量**（在 `docker-compose.yml` 中配置）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |
| `DATA_DIR` | `/data` | 数据存储目录 |
| `ENCRYPTION_KEY` | 自动生成 | API Key 等敏感配置的加密密钥，不设置则自动生成并保存到 `data/config/.encryption-key` |
| `ADMIN_TOKEN` | 无 | 管理后台认证 Token，生产环境必须设置，不设置则无认证保护 |

> **重要**：
> - 如果需要跨重启保留加密密钥，请设置 `ENCRYPTION_KEY` 环境变量。否则容器重建后自动生成的密钥会变化，导致已加密的 API Key 无法解密。
> - **生产环境必须设置 `ADMIN_TOKEN`**，否则管理后台接口无认证保护。

### 方式二：源码运行

**前置要求**：Node.js 18+

```bash
# 1. 克隆仓库
git clone https://gitee.com/songguanglong/all-your-handover.git
cd all-your-handover

# 2. 安装依赖
npm install

# 3. 开发模式（热重载）
npm run dev

# 4. 生产构建
npm run build

# 5. 生产运行
npm start
```

**CLI 参数**：

```bash
# 指定端口
node dist/index.js --port 8080

# 指定数据目录
node dist/index.js --data /var/lib/handover

# 卸载系统服务（Linux）
node dist/index.js uninstall
```

**环境变量**：

```bash
# 复制模板并修改
cp .env.example .env.local

# 编辑 .env.local
PORT=3000
DATA_DIR=./data
ENCRYPTION_KEY=your-encryption-key-here  # 可选
```

### 方式三：Linux 系统服务

```bash
# 安装为 systemd 服务（需要 sudo）
sudo node dist/index.js --data /var/lib/handover

# 服务会自动注册为 systemd 服务
# 日志输出到 /var/log/all-your-handover/

# 卸载服务
node dist/index.js uninstall
```

### 方式四：Windows Server 服务

**前置要求**：Windows Server 2012+，管理员权限，[NSSM](https://nssm.cc/download)

```cmd
:: 1. 构建应用
npm install
npm run build

:: 2. 下载 nssm.exe 放入 scripts/ 目录
::    https://nssm.cc/download

:: 3. 以管理员身份运行安装脚本
scripts\install-service.bat

:: 4. 编辑配置（可选，修改后需重启服务）
notepad .env.win
nssm restart AllYourHandover
```

**卸载服务**：

```cmd
:: 以管理员身份运行（数据保留）
scripts\uninstall-service.bat
```

**服务管理**：

| 命令 | 说明 |
|------|------|
| `nssm start AllYourHandover` | 启动服务 |
| `nssm stop AllYourHandover` | 停止服务 |
| `nssm restart AllYourHandover` | 重启服务 |
| `nssm status AllYourHandover` | 查看状态 |
| `nssm edit AllYourHandover` | 编辑服务配置（GUI） |

### 首次使用

1. **启动服务**后访问 `http://localhost:3000/admin`
2. **初始化向导**：按提示添加 LLM Provider 和飞书应用配置
3. **创建渠道**：填写飞书群 chatId 和名称
4. **配置飞书 Webhook**：将 Webhook URL 配置到飞书开放平台
5. **在群聊中测试**：发送 `@自己 交班` 触发交班流程

### 飞书应用配置

1. 登录[飞书开放平台](https://open.feishu.cn/)创建企业自建应用
2. 添加机器人能力
3. 配置事件订阅 URL：`https://你的域名:3000/webhook/feishu`
4. 订阅事件：`im.message.receive_v1`（接收消息）
5. 开启"接收群聊中所有消息"（如需 messageFilter=all）
6. 在 Web 后台 → 平台配置 中填写 App ID 和 App Secret

### 数据备份

所有数据存储在 `DATA_DIR` 目录下，备份方式：

```bash
# 直接复制数据目录
cp -r ./data ./data-backup-$(date +%Y%m%d)

# 或利用内置 Git 版本控制
cd ./data && git log --oneline -10
```

数据目录结构：

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
│   │   ├── preview-items.json   # 条目跟踪
│   │   └── pending.json         # 待交接状态
│   ├── handovers/YYYY-MM/       # 交接记录归档
│   ├── soul.md                 # 灵魂人设
│   ├── agents.md               # 行为规则
│   ├── experience.json         # 经验规则
│   ├── channel-memory.md        # 渠道记忆
│   ├── template.md             # 交接模板
│   ├── system-prompt.txt        # 系统 Prompt
│   └── dreaming/                # 梦境反思数据
└── logs/app.log
```

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 开发模式（tsx watch）
npm run build        # 编译 TypeScript
npm test             # 运行测试
npm run test:watch   # 测试监听模式
npm run lint         # ESLint 检查
npx vitest run test/some-file.test.ts   # 单个测试文件
```

## 技术栈

- TypeScript + Node.js + Express（单进程，无数据库）
- 纯 HTML + 原生 JS（管理后台 + H5 页面，无构建工具）
- Git 内置版本控制（自动提交数据变更，30s 防抖）
- AES-256-GCM 加密（API Key、App Secret 等敏感配置）
- 飞书 SDK 自实现（无第三方 SDK 依赖）

## 文档

- [产品设计文档](docs/all-your-handover.md)
- [开发指南](CLAUDE.md)

## License

All rights reserved.