---
title: Git 自动提交数据变更
date: 2026-04-10
status: accepted
context: 文件存储需要版本控制，用户不会手动 git commit
options:
  - 手动 commit：用户需要了解 Git
  - 自动 commit：30s 防抖，透明化
decision: 所有数据变更自动 git commit，30s 防抖
consequences:
  + 用户无需了解 Git，历史自动保留
  - 生成大量 commit，log 可读性下降
  - 需要 graceful shutdown 时 flush pending commits
---