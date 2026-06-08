---
title: 两种交接模式都必须通过 H5 确认，不自动归档
date: 2026-04-10
status: accepted
context: 避免误归档导致数据丢失
decision: requireAccept=true（需不同人确认）和 requireAccept=false（交班人自行确认）都必须 H5 点击确认
consequences:
  + 防止误操作
  + 给交班人最后检查机会
  - 增加一步操作
---