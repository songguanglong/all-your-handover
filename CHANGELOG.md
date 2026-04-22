# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-04-21

### Added
- Agent 智能系统（soul-service, agents-service, experience-service, channel-memory-service, dream-service, diff-detector）
- preview-items.json 并行跟踪（用户编辑后按 marker 对账）
- H5 移动端飞书 OAuth 认证（h5-auth.ts）
- 模型路由（按 analyze/review 任务指定不同 Provider）
- 系统 Prompt 访谈式生成
- 管理后台 Agent 管理 API（灵魂设定、经验管理、梦境配置）
- Windows Server NSSM 一键服务注册部署方案
- 完整安装部署文档（Docker/源码/Linux systemd/Windows NSSM）

### Fixed
- **P0-1** 记忆闭环：channel-memory 和 experience 注入 buildContextPrompt()
- **P0-2** requireAccept=false 时也需要 H5 确认，不再自动归档
- **P1-1** H5 前端集成飞书 OAuth 认证，传递真实用户身份
- **P1-2** 用户编辑预览时触发 diff 检测和记录
- **P1-3** 用户编辑预览时触发经验学习和规则积累
- **P2-1** webhook 使用 getForTask('analyze') 替代 getDefault()
- **P2-2** preview-items.json 用于 robust 增量更新
- 全面安全加固（认证、限流、路径防护、信息泄露修复）

### Changed
- 产品设计文档从 v1.8 全量重写为 v2.1
- README 重写，增加完整安装部署说明
- CLAUDE.md 更新架构描述（Agent 子系统、H5、模型路由）
- 版本号从 0.1.0 升到 0.2.0

## [0.1.0] - 2026-04-10

### Added
- MVP 完整功能：飞书 Bot 接入、多群支持、LLM 实时分析、草稿存储、交接卡片、Web 管理后台
- 支持文本/图片/语音多模态消息分析
- Git 自动提交（30s 防抖）
- AES-256-GCM 加密存储
- 上下文注入（上一班交接记录）
- 系统 Prompt 可配置
- 交接模板可配置
- 飞书签名验证、防重放
- 消息撤回处理
- raw.jsonl 持久化（交接后不清空，写入 handover_boundary 标记）
- SSE 实时推送（H5 页面实时更新）
- 完整性检查（草稿消息数 vs 分析条目数）
- LLM 队列（每渠道 FIFO + 全局信号量，并发 3，2 次重试）

### Security
- 全面安全加固：XSS 防护、路径遍历防护、认证中间件、限流、错误信息脱敏
