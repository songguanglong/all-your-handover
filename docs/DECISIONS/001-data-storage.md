---
title: 选择文件存储而非数据库
date: 2026-04-10
status: accepted
context: 需要零部署依赖，目标用户无运维能力
options:
  - SQLite：轻量但仍有 SQL 依赖，需要迁移
  - 文件存储：零依赖，天然版本化，用户可手动查看
decision: 使用 Markdown/JSON 文件 + Git 自动提交（30s 防抖）
consequences:
  + 零运维、用户可控、天然版本化
  - 并发写入需要文件锁（atomicWriteFile + acquireLock）
  - 查询性能受限，无原生全文搜索
  - 复杂关联查询困难
---