---
title: Admin API 错误使用 sanitizeError 不泄露堆栈
date: 2026-04-10
status: accepted
context: 防止信息泄露攻击（如通过错误消息推断文件路径、内部结构）
decision: admin 路由统一使用 sanitizeError()，返回 generic 'Internal error'，堆栈记录到服务端日志
consequences:
  + 防止信息泄露
  + 统一错误格式
  - 调试时需要查看服务端日志
---