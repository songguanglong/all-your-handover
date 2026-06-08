---
title: Diff 检测闭环：用户编辑触发 → 候选累积 → 自动写入记忆
date: 2026-04-10
status: accepted
context: 用户修改 LLM 输出是宝贵反馈，需要自动捕获
decision:
  1. 用户编辑 preview → detectDiffs()
  2. 对比 analysis items vs 新内容 → recordDiffCandidate()
  3. candidates.json 累积，同类 diff 重复 ≥2 次
  4. 自动写入 channel-memory.md 纠错记录
  5. 下次 buildContextPrompt 注入
consequences:
  + 自动学习用户偏好
  + 无需人工干预
  - 可能有误报，需要置信度机制
---