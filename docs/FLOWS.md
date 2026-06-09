# 业务流流程图 — All Your Handover

> **目的**：用可视化流程图描述各核心业务流程，明确区分**代码逻辑**与**大模型处理**。与 `PARADIGM.md` 配合使用 — `PARADIGM.md` 描述架构哲学与模块边界，本文档描述业务流程中的调用链路。
>
> **图例**：
> - <span style="display:inline-block;width:12px;height:12px;background:#e1f5fe;border:1px solid #01579b;margin-right:4px;"></span> **代码逻辑** — 纯代码执行
> - <span style="display:inline-block;width:12px;height:12px;background:#fff3e0;border:1px solid #e65100;margin-right:4px;"></span> **大模型处理** — LLM 调用（`provider.analyzeText` / `chatCompletion` 等）
> - <span style="display:inline-block;width:12px;height:12px;background:#e8f5e9;border:1px solid #2e7d32;margin-right:4px;"></span> **数据/文件** — 文件读写或 JSON/Markdown 存储
> - <span style="display:inline-block;width:12px;height:12px;background:#f3e5f5;border:1px solid #6a1b9a;margin-right:4px;"></span> **外部系统** — 飞书 IM、H5 前端等

---

## 一、随手记流程

> 飞书群聊消息 → 接收 → 分析 → 更新草稿预览 → SSE 推送

```mermaid
flowchart TD
    subgraph External["外部系统"]
        F[飞书群聊消息]:::external
    end

    subgraph Webhook["webhook.ts"]
        W1[verifyFeishuSignature]:::code
        W2[receiveMessage]:::code
        W3[parseCommand]:::code
    end

    subgraph RecordSvc["record-service.ts"]
        R1[handleTextMessage]:::code
        R2[appendRawRecord]:::data
        R3[buildContextPrompt]:::code
        R4[handleAnalysisResult]:::code
        R5[validateAnalysis]:::code
        R6[updateAnalysis]:::data
        R7[incrementalUpdatePreview]:::data
        R8[notifyDraftUpdate]:::code
    end

    subgraph LLMQueue["llm-queue.ts"]
        Q1[enqueue]:::code
        Q2[drainChannel]:::code
        Q3[callWithRetry]:::code
    end

    subgraph LLM["大模型层"]
        L1[provider.analyzeText]:::llm
        L2[provider.analyzeImage]:::llm
        L3[provider.transcribeAudio]:::llm
    end

    subgraph Events["draft-events.ts"]
        E1[SSE 推送]:::code
    end

    F --> W1
    W1 --> W2
    W2 --> W3
    W3 -->|非指令消息| R1
    R1 --> R2
    R2 -->|raw.jsonl| R3
    R3 --> Q1
    Q1 --> Q2
    Q2 --> Q3
    Q3 -->|文本| L1
    Q3 -->|图片| L2
    Q3 -->|语音| L3
    L1 --> R4
    L2 --> R4
    L3 --> R4
    R4 --> R5
    R5 --> R6
    R6 -->|analysis.json| R7
    R7 -->|preview.md + preview-items.json| R8
    R8 --> E1

    classDef code fill:#e1f5fe,stroke:#01579b
    classDef llm fill:#fff3e0,stroke:#e65100
    classDef data fill:#e8f5e9,stroke:#2e7d32
    classDef external fill:#f3e5f5,stroke:#6a1b9a
```

**关键说明**：
- `buildContextPrompt()` 每次注入 soul + agents + channel-memory(纠错记录/禁忌) + experience(规则)
- `llm-queue.ts` 每渠道 FIFO + 全局信号量（并发 3，2 次重试）
- 消息撤回 → `handleMessageRecalled()` → raw.jsonl 追加 tombstone → analysis 标记 recalled → 从 preview 移除

---

## 二、交接流程

> 群聊指令发起 → H5 页面确认/打回 → 归档或取消

```mermaid
flowchart TD
    subgraph Feishu["飞书群聊"]
        CMD[@自己 交班]:::external
    end

    subgraph Webhook2["webhook.ts"]
        H1[HANDOVER_START 指令]:::code
    end

    subgraph Orchestrator["handover-orchestrator.ts"]
        O1[handleHandoverStart]:::code
        O2[readPreview]:::data
        O3[findPending]:::data
        O4[completenessCheck]:::code
        O5[savePending]:::data
        O6[handleHandoverAccept]:::code
        O7[identityCheck]:::code
        O8[buildHandoverRecord]:::code
        O9[saveHandoverRecord]:::data
        O10[clearDraftData]:::data
        O11[handleHandoverReject]:::code
        O12[removePending]:::data
    end

    subgraph H5API["h5-api.ts"]
        A1[POST /handover/:code/start]:::code
        A2[POST /handover/:code/accept]:::code
        A3[POST /handover/:code/reject]:::code
    end

    subgraph H5["H5 移动端"]
        H5A[点击 确认接班]:::external
        H5B[点击 打回]:::external
    end

    subgraph Card["飞书卡片"]
        C1[发送交接卡片含 H5 链接]:::external
        C2[发送完成确认卡片]:::external
        C3[发送打回通知]:::external
    end

    CMD --> H1
    H1 --> O1
    O1 --> O2
    O2 --> O3
    O3 -->|无待交接| O4
    O4 -->|通过| O5
    O5 -->|pending.json| C1
    C1 --> H5A
    C1 --> H5B
    H5A --> A2
    A2 --> O6
    O6 --> O7
    O7 -->|Mode A: 确认人 ≠ 交班人<br/>Mode B: 确认人 = 交班人| O8
    O8 --> O9
    O9 -->|handovers/YYYY-MM/*.md| O10
    O10 -->|writeHandoverBoundary<br/>clearAnalysis<br/>clearPreview| O12
    O12 --> C2
    H5B --> A3
    A3 --> O11
    O11 --> O12
    O12 --> C3

    classDef code fill:#e1f5fe,stroke:#01579b
    classDef data fill:#e8f5e9,stroke:#2e7d32
    classDef external fill:#f3e5f5,stroke:#6a1b9a
```

**关键说明**：
- 两种模式（`requireAccept=true/false`）均保存 pending.json，均需 H5 确认，不自动归档
- `clearDraftData` 不清空 `raw.jsonl`，仅写入 `handover_boundary` 标记

---

## 三、记忆闭环

> 用户编辑预览 → 检测差异 → 候选累积 → 自动写入渠道记忆

```mermaid
flowchart TD
    subgraph H5Edit["H5 用户操作"]
        EDIT[编辑 preview.md]:::external
    end

    subgraph H5PUT["h5-api.ts"]
        P1[PUT /draft/:code/preview]:::code
        P2[updatePreview]:::code
        P3[marker 被删除]:::code
        P4[marker 仍存在]:::code
    end

    subgraph DiffDetector["diff-detector.ts"]
        D1[detectDiffs]:::code
        D2[urgency/category/content<br/>逐字段对比]:::code
    end

    subgraph MemorySvc["channel-memory-service.ts"]
        M1[recordDiffCandidate]:::code
        M2[load candidates.json]:::data
        M3[findSameTypeCandidate]:::code
        M4[count ≥ 2 ?]:::code
        M5[writeCandidateToMemory]:::code
        M6[getChannelMemory]:::data
        M7[appendToSection]:::code
        M8[saveChannelMemory]:::data
    end

    subgraph MemoryFile["channel-memory.md"]
        MF[纠错记录 / 禁忌]:::data
    end

    EDIT --> P1
    P1 --> P2
    P2 --> P3
    P2 --> P4
    P3 -->|内容删除/重写| M1
    P4 --> D1
    D1 --> D2
    D2 -->|字段变更| M1
    M1 --> M2
    M2 --> M3
    M3 --> M4
    M4 -->|是| M5
    M5 --> M6
    M6 --> M7
    M7 --> M8
    M8 -->|写入| MF
    M4 -->|否| M2

    classDef code fill:#e1f5fe,stroke:#01579b
    classDef data fill:#e8f5e9,stroke:#2e7d32
    classDef external fill:#f3e5f5,stroke:#6a1b9a
```

**关键说明**：
- `channel-memory.md` 仅 **纠错记录** 和 **禁忌** 两个 Section 注入 LLM prompt
- 同类 diff 重复 ≥2 次 → 自动写入记忆，无需人工干预
- 写入后的记忆通过 `buildContextPrompt()` 注入下一次 LLM 分析

---

## 四、经验学习

> 用户编辑预览 → LLM 推断编辑意图 → 生成规则 → 写入经验库

```mermaid
flowchart TD
    subgraph H5Edit2["H5 用户操作"]
        EDIT2[编辑 preview.md]:::external
    end

    subgraph H5PUT2["h5-api.ts"]
        P5[PUT /draft/:code/preview]:::code
        P6[updatePreview]:::code
        P7[旧内容 ≠ 新内容]:::code
    end

    subgraph ExpSvc["experience-service.ts"]
        E2[analyzeEditIntent]:::llm
        E3[system prompt 构建]:::code
        E4[chatCompletion 'quick']:::llm
        E5[addEntry]:::code
    end

    subgraph ExpFile["experience.json"]
        EF[经验规则列表]:::data
    end

    EDIT2 --> P5
    P5 --> P6
    P6 --> P7
    P7 --> E2
    E2 --> E3
    E3 --> E4
    E4 -->|推断意图<br/>生成规则| E5
    E5 -->|追加| EF

    classDef code fill:#e1f5fe,stroke:#01579b
    classDef llm fill:#fff3e0,stroke:#e65100
    classDef data fill:#e8f5e9,stroke:#2e7d32
    classDef external fill:#f3e5f5,stroke:#6a1b9a
```

**关键说明**：
- `analyzeEditIntent` 比较 LLM 原始输出 vs 用户编辑后的内容，让 LLM 推断"用户为什么改了这里"
- 生成的规则通过 `buildExperiencePrompt()` 注入下一次 LLM 分析

---

## 五、梦境反思

> 交接归档后 → 计算修改率 → LLM 分析差异 → 高置信度自动写入记忆

```mermaid
flowchart TD
    subgraph Admin["管理后台"]
        ADM[POST /admin/channels/:code/agent/dream/trigger]:::external
    end

    subgraph DreamSvc["dream-service.ts"]
        D3[runPostHandoverDream]:::code
        D4[计算修改率]:::code
        D5[修改率 > 30% ?]:::code
        D6[chatCompletion]:::llm
        D7[parseDreamCandidates]:::code
        D8[processCandidates]:::code
        D9[confidence ≥ 0.8 ?]:::code
        D10[saveChannelMemory]:::data
        D11[saveReviewRecord]:::data
    end

    subgraph MemoryFile2["channel-memory.md"]
        MF2[纠错记录 / 禁忌]:::data
    end

    subgraph ReviewDir["dreaming/reviews/"]
        RD[待人工审核记录 *.md]:::data
    end

    ADM --> D3
    D3 --> D4
    D4 --> D5
    D5 -->|是| D6
    D6 -->|LLM 分析差异<br/>生成候选记忆| D7
    D7 --> D8
    D8 --> D9
    D9 -->|是| D10
    D10 -->|写入| MF2
    D9 -->|否| D11
    D11 -->|保存| RD
    D5 -->|否| D3

    classDef code fill:#e1f5fe,stroke:#01579b
    classDef llm fill:#fff3e0,stroke:#e65100
    classDef data fill:#e8f5e9,stroke:#2e7d32
    classDef external fill:#f3e5f5,stroke:#6a1b9a
```

**关键说明**：
- 当前仅通过 Admin API **手动触发**（`admin-agent.ts:148`）
- 高置信度（≥0.8）自动写入 `channel-memory.md`，低置信度存入 `dreaming/reviews/` 待审核
- 未来可接入 `handleHandoverAccept` 实现全自动触发

---

## 六、H5 交互 API 全景

> H5 移动端与后端的所有 API 调用链路

```mermaid
flowchart LR
    subgraph H5Client["H5 前端"]
        H5_1[草稿查看]:::external
        H5_2[编辑保存]:::external
        H5_3[班次归属]:::external
        H5_4[发起交班]:::external
        H5_5[确认接班]:::external
        H5_6[打回]:::external
        H5_7[SSE 监听]:::external
    end

    subgraph H5Routes["h5-api.ts"]
        API_1[GET /draft/:code]:::code
        API_2[GET /draft/:code/status]:::code
        API_3[PUT /draft/:code/preview]:::code
        API_4[POST /draft/:code/assign-shift]:::code
        API_5[POST /handover/:code/start]:::code
        API_6[POST /handover/:code/accept]:::code
        API_7[POST /handover/:code/reject]:::code
        API_8[GET /draft/:code/events]:::code
    end

    subgraph Services["Services"]
        S1[draft-preview-service.ts]:::data
        S2[draft-analysis-service.ts]:::data
        S3[draft-raw-service.ts]:::data
        S4[handover-orchestrator.ts]:::code
        S5[diff-detector.ts]:::code
        S6[experience-service.ts]:::llm
        S7[channel-memory-service.ts]:::data
    end

    subgraph SSE["draft-events.ts"]
        SSE1[EventSource /events]:::code
        SSE2[notifyDraftUpdate]:::code
    end

    H5_1 --> API_1
    H5_1 --> API_2
    API_1 --> S1
    API_1 --> S2
    API_1 --> S3

    H5_2 --> API_3
    API_3 --> S1
    API_3 --> S5
    API_3 --> S6
    API_3 --> S7
    API_3 --> SSE2

    H5_3 --> API_4
    API_4 --> S1
    API_4 --> SSE2

    H5_4 --> API_5
    API_5 --> S4
    API_5 --> S1

    H5_5 --> API_6
    API_6 --> S4
    API_6 --> S1

    H5_6 --> API_7
    API_7 --> S4

    H5_7 --> API_8
    API_8 --> SSE1
    SSE2 --> SSE1

    classDef code fill:#e1f5fe,stroke:#01579b
    classDef llm fill:#fff3e0,stroke:#e65100
    classDef data fill:#e8f5e9,stroke:#2e7d32
    classDef external fill:#f3e5f5,stroke:#6a1b9a
```

**关键说明**：
- 读操作（GET draft/status/events）使用 `h5OptionalAuth`（匿名可访问）
- 写操作（PUT preview / POST handover/assign-shift）使用 `h5RequireAuth`（401 拒绝匿名）
- SSE 通过 `notifyDraftUpdate()` 统一触发：LLM 分析完成、预览编辑、班次归属、消息撤回、交接状态变更

---

## 文档层级定位

| 层级 | 文件 | 内容 |
|------|------|------|
| L2 范式 | `PARADIGM.md` | 架构哲学、模块边界、数据流文字描述 |
| **L2 流程** | **`docs/FLOWS.md`** | **本文档 — 业务流程可视化（当前）** |
| L3 决策 | `docs/DECISIONS/` | 每个架构决策的"为什么" |
| L4 规则 | `docs/AI_RULES.md` | 编码风格、禁止模式 |

---

*文件位置：`docs/FLOWS.md`*
