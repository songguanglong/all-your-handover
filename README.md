# All Your Handover

轻量级本地部署的酒店交接班工具 — 数据自有，交接由你做主

## 核心理念

- **数据自有**：所有数据存储在客户本地，Markdown 文件格式
- **一键部署**：下载即用，单可执行文件零依赖
- **零配置启动**：无需预设员工表、班次表，开箱即用
- **群聊交互**：飞书群聊即入口，`@自己 交班/接班/草稿`

## 快速开始

```bash
# 开发模式
npm install
npm run dev

# 构建
npm run build

# 生产运行
npm start
```

## 技术栈

- TypeScript + Node.js
- Express (Web 服务 + 管理后台)
- 纯 HTML + 原生 JS (管理后台前端)
- Git 版本控制 (内置)

## 文档

- [产品设计文档](docs/all-your-handover.md)

## License

MIT