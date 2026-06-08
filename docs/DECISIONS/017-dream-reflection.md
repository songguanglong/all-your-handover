---
title: 交接后自动触发梦境反思，高置信度写入记忆
date: 2026-04-10
status: accepted
context: 单次交接的修改模式可能揭示长期规律
decision:
  1. 交接归档后 → dream-service → 计算修改率
  2. 修改率 >30% → LLM 分析差异 → 生成候选记忆
  3. 置信度 ≥0.8 → 自动写入 channel-memory.md
  4. 置信度 <0.8 → 保存到 dreaming/reviews/ 待人工审核
consequences:
  + 交接级反思，发现群体偏好
  + 低置信度候选不污染记忆
  - 需要额外 LLM 调用
---