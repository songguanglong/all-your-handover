---
title: channel-memory 和 experience 注入 buildContextPrompt
date: 2026-04-10
status: accepted
context: Agent 智能系统需要记忆闭环才能生效
decision: buildContextPrompt() 每次 LLM 调用前注入 soul + agents + channel-memory (纠错记录/禁忌) + experience (规则)
consequences:
  + 记忆真正影响 LLM 输出
  + 越用越准
  - prompt 长度增加，可能增加 token 消耗
---