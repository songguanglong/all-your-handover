---
title: 飞书签名使用 SHA256 而非 HMAC
date: 2026-04-10
status: accepted
context: 飞书开放平台 webhook 签名验证机制
decision: 使用 SHA256(timestamp + nonce + encryptKey + body)，配合 timingSafeEqual
decision-note: 这是飞书平台的规范要求，非项目自主选择
consequences:
  + 与飞书规范一致
  - 与常规 HMAC-SHA256 不同，容易误实现
---