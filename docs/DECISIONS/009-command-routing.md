---
title: 交班仅通过群聊触发，接班/打回通过 H5
date: 2026-04-10
status: accepted
context: 简化群聊交互，减少误操作
options:
  - 全部在群聊：命令复杂，容易误触
  - 交班在群聊、确认在 H5：分工明确
decision: 交班指令仅 `@自己 交班`（群聊），接班/打回通过 H5 页面完成
consequences:
  + 群聊交互简洁
  + H5 页面操作更友好
  - 需要额外学习 H5 操作
---