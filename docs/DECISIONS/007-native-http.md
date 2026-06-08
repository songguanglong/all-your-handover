---
title: 使用原生 http/https 模块，禁止第三方 HTTP 客户端
date: 2026-04-10
status: accepted
context: 减少依赖，控制包体积，单可执行文件打包
decision: 所有 HTTP 请求使用原生 Node.js http/https 模块
consequences:
  + 零额外依赖
  + 单文件打包（pkg）更容易
  - 代码冗长（需手动处理流、超时、重试）
---