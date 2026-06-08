---
title: 草稿拆分为 4 个文件（raw/analysis/preview/preview-items）
date: 2026-04-10
status: accepted
context: 单一文件职责不清晰，用户编辑后难以对账
decision:
  - raw.jsonl: 追加写入原始消息
  - analysis.json: LLM 分析结果
  - preview.md: Markdown 预览（含 msg 标记）
  - preview-items.json: 结构化条目跟踪（用户编辑后按 marker 对账）
consequences:
  + 职责分离，调试方便
  + preview-items.json 保证用户编辑后仍可追踪条目
  - 文件数量增加，需要一致性维护
---