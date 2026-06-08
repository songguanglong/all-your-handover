---
title: preview-items.json 并行跟踪，用户编辑后按 marker 对账
date: 2026-04-10
status: accepted
context: 用户编辑 preview.md 可能删除 HTML 标记，导致条目丢失
decision: 维护 preview-items.json 作为结构化副本，用户编辑后扫描剩余标记对账
consequences:
  + 用户编辑不会丢失条目映射
  + 支持 diff 检测和经验学习
  - 需要保持 preview.md 和 preview-items.json 同步
---