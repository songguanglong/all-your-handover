---
title: 管理后台无 HTTP Basic Auth，信任内网环境
date: 2026-04-10
status: accepted
context: 产品定位本地部署，用户在内网使用
decision: 管理后台无 HTTP Basic Auth，admin API 通过 ADMIN_TOKEN Bearer 保护
consequences:
  + 简化部署
  - 内网泄露风险
  - ADMIN_TOKEN 未设置时无保护（开发环境）
---