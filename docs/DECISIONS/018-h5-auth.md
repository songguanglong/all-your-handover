---
title: H5 认证使用飞书 JS-SDK OAuth
date: 2026-04-10
status: accepted
context: H5 页面需要识别用户身份（交班人/接班人）
options:
  - 自建用户名密码：增加复杂度
  - 飞书 OAuth：用户无感知，利用已有飞书身份
decision: H5 使用飞书 JS-SDK OAuth，无认证时匿名回退（h5_user）
consequences:
  + 无需自建认证体系
  + 用户无感知登录
  - 强依赖飞书生态
---