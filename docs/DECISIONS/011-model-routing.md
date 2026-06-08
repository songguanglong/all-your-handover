---
title: 模型路由支持按任务指定不同 Provider
date: 2026-04-10
status: accepted
context: 消息分析需要快速响应，交接生成需要高质量
decision: 支持 routes.analyze 和 routes.review 分别指定 Provider，未配置时回退到 defaultProviderId
consequences:
  + 分析可用廉价模型，生成可用高级模型
  + 成本优化
  - 配置复杂度增加
---