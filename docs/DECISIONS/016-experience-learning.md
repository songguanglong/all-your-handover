---
title: 经验学习闭环：用户编辑 → LLM 推断意图 → 规则积累
date: 2026-04-10
status: accepted
context: 比 diff 检测更高层次的学习——理解用户为什么编辑
decision:
  1. 用户编辑 preview → analyzeEditIntent(LLM) 推断意图
  2. 生成经验规则 → addEntry() → experience.json
  3. buildExperiencePrompt() → 注入下次 LLM 调用
consequences:
  + 学习到结构化规则（如"紧急事项应标紧急"）
  + 比 diff 检测更抽象
  - 依赖 LLM 推断准确性
---