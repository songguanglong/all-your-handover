---
title: LLM Provider 兼容 OpenAI /chat/completions 接口
date: 2026-04-10
status: accepted
context: 支持多厂商模型（OpenAI / DeepSeek / Moonshot / 未来更多）
options:
  - 每个 Provider 独立 SDK：代码重复，维护成本高
  - 统一 OpenAI 接口：一个 BaseLLMProvider 基类，新增 Provider 只需注册
decision: 所有 Provider 实现必须兼容 OpenAI /chat/completions 格式
consequences:
  + 新增 Provider 成本低（继承基类即可）
  + 模型路由统一
  - 无法利用 Provider 特有功能（如 DeepSeek reasoning）
---