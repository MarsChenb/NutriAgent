# NutriAgent 技术白皮书

## 1. 项目摘要

NutriAgent 是一个面向减脂与健康管理场景的移动端优先 AI Agent Web 应用。它的目标不是做通用聊天页面，而是把一个真实可讲的健康管理闭环做出来：

`首次建档 -> 每日记录 -> Agent 私教 -> 周计划 / 周复盘`

当前版本的重点不在“堆概念”，而在于把以下三件事落到代码和产品形态里：

1. 用真实业务链路承载 Agent，而不是单纯展示模型回答。
2. 用规则、结构化数据和工具调用约束模型行为，降低关键结果的漂移。
3. 用移动端优先的前端形态，把项目做成适合演示、录屏和简历表达的完整作品。

---

## 2. 解决的问题

健康管理类 AI 应用常见的问题有两类：

1. 只有聊天，没有业务闭环。用户问完就结束，无法形成长期价值。
2. 只有推荐，没有执行上下文。模型不知道用户当天吃了什么、练了什么、还剩多少预算，只能泛泛而谈。

NutriAgent 试图解决的是第二种更真实的问题：在减脂和健康管理场景下，如何把用户画像、当日执行数据、历史偏好和模型能力组合成一个任务型 Agent 产品。

项目因此采用了两层设计：

1. 业务层保证“算得清”
2. Agent 层保证“说得对、问得准、能继续执行”

---

## 3. 产品闭环

当前产品闭环如下：

```text
选择教练
-> 移动端建档
-> 今日健康工作台
-> 文本 / 图片记录餐食
-> 记录运动
-> Agent 私教分析与推荐
-> 周计划 / 周复盘
```

这个闭环的价值在于，Agent 不是孤立入口，而是嵌入在整个产品链路中：

1. 建档提供长期上下文。
2. 餐食和运动记录提供当天执行上下文。
3. 首页把数据聚合成“今日工作台”。
4. Agent 读取上下文后完成分析、推荐、解释和追问。
5. 周计划 / 周复盘把短期行为沉淀成阶段性反馈。

这使项目更接近真实 AI 应用，而不是单页 Demo。

---

## 4. 系统架构

### 4.1 总体结构

```text
Frontend (Next.js)
-> API Layer (FastAPI)
-> Agent Layer (Router / Planner / Clarifier / Tool Registry / Memory)
-> Domain Services (meal / exercise / health / rag / vision)
-> PostgreSQL + pgvector
```

### 4.2 前端职责

前端采用 Next.js App Router，重点不是复杂前端状态机，而是产品化表达：

1. 首页负责展示今日执行状态。
2. 建档页负责移动端一题一屏采集。
3. 记餐页负责文本 / 图片双入口。
4. 聊天页负责 Agent Studio 表达。
5. 周复盘页负责收束长期价值。

关键页面：

- [page.tsx](/d:/NutriAgent/frontend/src/app/page.tsx)
- [onboarding/page.tsx](/d:/NutriAgent/frontend/src/app/onboarding/page.tsx)
- [meals/page.tsx](/d:/NutriAgent/frontend/src/app/meals/page.tsx)
- [exercise/page.tsx](/d:/NutriAgent/frontend/src/app/exercise/page.tsx)
- [chat/page.tsx](/d:/NutriAgent/frontend/src/app/chat/page.tsx)
- [review/page.tsx](/d:/NutriAgent/frontend/src/app/review/page.tsx)

### 4.3 后端职责

后端采用 FastAPI + SQLAlchemy Async。它承担三类责任：

1. 提供标准化业务 API。
2. 聚合餐食、运动、健康数据。
3. 承载 Agent 主流程和上下文注入。

核心目录：

- [graph.py](/d:/NutriAgent/backend/app/agents/graph.py)
- [planner.py](/d:/NutriAgent/backend/app/agents/planner.py)
- [clarifier.py](/d:/NutriAgent/backend/app/agents/clarifier.py)
- [tool_registry.py](/d:/NutriAgent/backend/app/agents/tool_registry.py)
- [memory.py](/d:/NutriAgent/backend/app/agents/memory.py)
- [evaluation.py](/d:/NutriAgent/backend/app/agents/evaluation.py)

---

## 5. Agent 主链路设计

### 5.1 设计目标

当前版本不追求“无限复杂的多 Agent 图”，而是强调：

1. 简单请求能直接完成。
2. 复合请求能显式拆解。
3. 信息不足时会澄清。
4. 执行过程对前端可见。

因此主链路采用：

```text
User Input
-> Router
-> Direct Mode / Planned Mode / Clarification Mode
-> Planner
-> Tool Registry
-> Executor
-> Response + Plan + Trace + Context Snapshot
```

### 5.2 Router

Router 的作用是先判断用户请求属于哪种任务。当前意图包括：

- `log_meal`
- `lookup_food`
- `query_nutrition`
- `ask_knowledge`
- `recommend_recipe`
- `general_chat`

对应实现主要在 [router_agent.py](/d:/NutriAgent/backend/app/agents/router_agent.py)。

当前 Router 采用“LLM 分类 + 规则兜底”的思路：

1. 在线环境下优先走模型分类。
2. 为了本地开发和离线评估，保留规则 fallback。

这样做的原因很现实：如果没有规则兜底，路由能力很难做稳定回归测试。

### 5.3 Planner

Planner 负责判断请求是单步还是多步，并生成计划。

Planner 的核心判断逻辑在 [planner.py](/d:/NutriAgent/backend/app/agents/planner.py)：

1. 先检测是否存在复合连接词，如“并、然后、再、顺便、结合”。
2. 再检测是否同时出现“记录 + 预算分析”、“训练 + 推荐一餐”等复合信号。
3. 如果命中，进入 `planned` 模式；否则走 `direct` 模式。

Planner 输出的数据结构包括：

- `mode`
- `reasoning`
- `steps`

每个 step 都显式绑定一个 tool，例如：

- `log_meal`
- `answer_nutrition`
- `recommend_recipe`

这一步的意义在于，把“模型准备做什么”从隐式过程变成了显式计划。

### 5.4 Clarifier

Clarifier 是当前版本最重要的 Agent 可靠性设计之一。

如果用户说：

`我吃了鸡胸肉，帮我记一下并看看今天还能吃什么`

系统虽然能看出这是复合任务，但仍然缺少关键字段，例如：

- 这是早餐、午餐还是晚餐
- 大概吃了多少

此时不会直接执行，而是返回结构化澄清：

- `requires_clarification`
- `clarification_question`
- `missing_fields`

实现位于 [clarifier.py](/d:/NutriAgent/backend/app/agents/clarifier.py)。

当前版本重点处理三类缺参：

1. 缺餐次
2. 缺分量
3. 需要结合运动推荐时缺运动上下文

这种 Human-in-the-Loop 设计在面试中很值得讲，因为它直接体现了“不是让模型硬猜”。

### 5.5 Tool Registry

Tool Registry 的目标是把业务能力封装成统一工具，而不是把所有逻辑写死在聊天入口中。

实现位于 [tool_registry.py](/d:/NutriAgent/backend/app/agents/tool_registry.py)。

当前已接入的能力包括：

- `log_meal`
- `lookup_food`
- `answer_nutrition`
- `answer_knowledge`
- `recommend_recipe`
- `general_chat`

每个工具统一声明：

- `name`
- `description`
- `input_schema`
- `handler`
- `retryable`

这样做的好处有两个：

1. Agent 主流程可以面向工具编排，而不是直接耦合业务实现。
2. 后续若要扩展更多能力，例如 `log_exercise`、`weekly_review`，可以按工具继续挂接。

### 5.6 Executor 与 Trace

当前版本的 Executor 没有单独拆成独立模块，而是由 [graph.py](/d:/NutriAgent/backend/app/agents/graph.py) 负责按 plan 顺序执行工具。

每一步执行都会记录 trace，返回前端的数据包括：

- `mode`
- `plan`
- `execution_trace`
- `context_snapshot`

`execution_trace` 不是调试日志复制，而是面向产品展示做了摘要化处理。这样前端既能显示执行过程，又不会把内部结构直接暴露得太杂乱。

---

## 6. 规则负责算，模型负责说

这是当前项目最核心的工程原则之一。

### 6.1 哪些交给规则与结构化数据

以下信息尽量通过数据库和业务逻辑获得：

1. 餐食热量与营养素
2. 当日已摄入 / 已消耗 / 剩余预算
3. 热量缺口
4. 最近餐食和运动记录
5. 用户目标、过敏、忌口等长期信息

### 6.2 哪些交给模型

模型主要负责：

1. 任务分类
2. 餐食文本解析
3. 建议生成
4. 解释与总结
5. 对话语气与私教风格

### 6.3 这样设计的原因

如果把“算”也交给模型，会有三个问题：

1. 结果不稳定
2. 很难验证
3. 面试时解释不清系统边界

因此本项目明确把“数值正确性”和“自然语言表达”分开。这个点非常适合面试回答：

`规则和结构化数据负责算，LLM 负责说。`

---

## 7. 上下文工程与记忆体系

### 7.1 为什么需要上下文工程

健康管理不是一次性问答，而是强上下文场景。Agent 是否有用，很大程度取决于它有没有读到：

1. 用户是谁
2. 今天做了什么
3. 最近状态如何
4. 当前任务还缺什么

### 7.2 短期记忆

短期记忆由 [memory.py](/d:/NutriAgent/backend/app/agents/memory.py) 中的会话能力负责，主要保存：

1. 最近几轮对话
2. 当前 `conversation_id`
3. 澄清追问前后的上下文承接

短期记忆的作用不是长期个性化，而是保证“上一轮没说完的任务，这一轮能接上继续跑”。

### 7.3 长期记忆

长期记忆同样由 [memory.py](/d:/NutriAgent/backend/app/agents/memory.py) 管理，当前主要同步用户档案字段：

1. 目标
2. 日常活动水平
3. 口味偏好
4. 过敏信息
5. 饮食限制
6. 健康史

这些信息会落入 `long_term_memories`，并按重要度排序读取。

### 7.4 记忆注入策略

当前不是把所有历史都塞给模型，而是精选注入：

1. 用户画像
2. 今日摘要
3. 最近餐食
4. 最近运动
5. 重要长期记忆
6. 最近几轮会话

这样做有两个好处：

1. 控制上下文长度
2. 提升建议的相关性与可解释性

---

## 8. 数据层与业务模型

项目的核心业务对象包括：

1. 用户档案
2. 餐食记录
3. 运动记录
4. 体重变化
5. 长期记忆
6. 会话历史

从业务流上看，最重要的是“日粒度汇总”：

1. 餐食记录产生摄入数据
2. 运动记录产生消耗数据
3. 日汇总计算剩余热量与缺口
4. Agent 读取这些数据后生成建议
5. 首页与周复盘页统一展示结果

这使得整个产品不是“聊天驱动”，而是“数据闭环驱动，聊天负责解释和决策辅助”。

---

## 9. RAG 与知识增强

当前版本包含轻量 RAG 能力，定位很克制：

1. 不是做知识平台
2. 不是做海量文档问答
3. 而是为营养和减脂问答提供辅助知识上下文

知识链路包括：

1. 文档切块与导入
2. Embedding
3. `pgvector` 相似度检索
4. 将检索结果注入回答

这个能力主要用于“减脂原则、营养常识、训练后饮食建议”等知识型问题。它在项目中的作用是增强“答得更像专业私教”，而不是充当唯一真相来源。

---

## 10. 多模态输入设计

餐食记录支持两种入口：

1. 文本输入
2. 图片识别

文本链路适合高频日常记录，图片链路适合展示多模态能力。二者最终都会回流到统一的餐食结构和营养计算流程。

这个设计的意义是：

1. 保证演示时既有实用性，也有亮点。
2. 保证后端仍然维护统一数据口径。

---

## 11. 前端产品化设计

### 11.1 为什么要做移动端优先

健康管理天然更接近手机产品场景。相比桌面 dashboard，移动端优先更能体现：

1. 真实使用场景
2. 产品完成度
3. 演示观感

### 11.2 当前界面方向

前端重做后采用了以下视觉语言：

1. 浅色背景
2. 白色卡片
3. 大圆角
4. 柔和阴影
5. 固定底部主操作区

这使项目更接近健康类消费产品，而不是管理后台。

### 11.3 Agent Studio 表达

聊天页没有停留在“对话框 + 输入框”，而是增加了：

1. 快捷任务
2. 折叠式 `plan`
3. 折叠式 `execution_trace`
4. 澄清追问状态
5. 固定 demo 场景入口

这一步非常关键，因为它把 Agent 从“代码概念”变成了“肉眼可见的产品能力”。

---

## 12. 评估与验证

### 12.1 为什么要做最小评估

很多 Agent 项目有功能，没有验证。这样的问题是：

1. 很难知道改动有没有回归
2. 很难向面试官证明系统行为可控

因此当前版本增加了离线最小评估，见 [evaluation.py](/d:/NutriAgent/backend/app/agents/evaluation.py) 和 [test_agent_evaluation.py](/d:/NutriAgent/backend/tests/test_agent_evaluation.py)。

### 12.2 当前评估覆盖

默认 case 覆盖 5 类典型请求：

1. 食物热量查询
2. 记录餐食并分析预算
3. 结合运动推荐一餐
4. 营养知识问答
5. 泛化陪伴型对话

评估指标包括：

1. `intent_accuracy`
2. `plan_mode_accuracy`
3. `tool_selection_accuracy`
4. `clarification_accuracy`

当前测试门槛为各项不低于 `0.8`。这不是线上真实质量指标，但足以承担本地回归的角色。

### 12.3 当前验证方式

项目当前已做过的基础验证包括：

1. `python -m compileall app tests`
2. `python -m unittest tests.test_agent_planner tests.test_agent_memory tests.test_agent_evaluation -v`
3. `npm run build`

这意味着项目至少具备：

1. 后端静态可运行性
2. Agent 核心链路的最小回归能力
3. 前端可构建能力

---

## 13. 固定 Demo 场景

为了确保演示稳定，项目提供了固定 demo 路线，详见 [DEMO_SCENARIO.md](/d:/NutriAgent/DEMO_SCENARIO.md)。

推荐演示链路：

1. 展示教练选择与移动端建档
2. 展示今日健康工作台
3. 记录一顿晚餐
4. 进入 Agent 发起复合任务
5. 展示 `planned mode + plan + execution_trace`
6. 跳转到周计划 / 周复盘收束

这条 demo 路线的价值是把产品、Agent 和业务闭环在 3 分钟内讲完整。

---

## 14. 面试重点与推荐讲法

### 14.1 一句话定位

推荐这样介绍：

`这是一个移动端优先的 AI 健康教练 Agent Web 应用，我重点做的是把用户建档、餐食/运动记录和任务型 Agent 串成一个可演示的健康管理闭环。`

### 14.2 最值得强调的技术点

1. 不是裸聊，而是任务型 Agent。
2. 简单请求走 direct mode，复杂请求走 planned mode。
3. 关键业务值来自规则和数据库，不完全交给模型。
4. 缺参时先澄清追问，而不是硬答。
5. 前端显式展示 `plan` 和 `execution_trace`。
6. 有短期记忆、长期记忆和最小离线评估。

### 14.3 常见追问的回答方向

如果被问“为什么这能算 Agent 项目”，可以回答：

`因为它不只是意图分类后直接回复，而是具备了任务拆解、工具封装、澄清追问、显式执行过程和上下文记忆。`

如果被问“为什么不用更复杂的多 Agent 图”，可以回答：

`当前版本优先做稳定可演示的任务型 Agent。复杂图式协作不是不能做，而是先确保单链路拆解、工具调用和执行可解释性成立。`

如果被问“怎么保证准确性”，可以回答：

`我把热量、缺口、营养结构这些关键值尽量放在结构化数据层计算，模型主要负责分类、解释和建议生成。`

---

## 15. 当前取舍与不足

项目当前是作品集导向实现，因此做了明确取舍。

### 15.1 有意取舍

1. 单用户优先，不先处理多租户和权限系统。
2. 任务型 Agent 优先，不先做复杂自反思或长链自治。
3. 最小评估优先，不先做完整线上观测平台。
4. 移动端展示优先，不先做桌面复杂工作台。

### 15.2 当前不足

1. Clarifier 仍以规则为主，复杂缺参场景还可以更细。
2. Planner 目前是轻量拆解，还没有引入更复杂的动态重规划。
3. Memory 还没有完整生命周期管理与衰减策略。
4. RAG 评估仍是轻量级，未建立系统化问答质量指标。
5. 测试覆盖面仍偏窄，更多集中在 Agent 核心链路。

这些不足不是缺陷掩盖点，而是很适合在面试中展示工程判断的地方：当前版本的目标是“做成一个可讲、可演示、可继续演进的 Agent 产品骨架”。

---

## 16. 后续演进方向

如果继续向真正的生产级 Agent 系统推进，优先级建议如下：

1. 增加更稳健的工具参数抽取与校验。
2. 增加 `log_exercise`、`weekly_review` 等工具并接入 Planner。
3. 为 Planner 增加失败重试和重规划机制。
4. 引入更完整的 trace 持久化与可观测面板。
5. 建立线上评估与用户行为反馈闭环。
6. 完善记忆检索与更新策略。

---

## 17. 结论

NutriAgent 当前版本的核心价值，不在于它是不是“最复杂的 Agent 系统”，而在于它把一个真实健康场景里的 Agent 产品最关键的部分做实了：

1. 有完整业务闭环
2. 有任务型 Agent 主链路
3. 有显式工具和澄清机制
4. 有可视化的执行过程
5. 有移动端产品形态
6. 有最小可验证能力

如果用于 AI 应用开发或 Agent 开发岗位，这个项目最强的讲法不是“我堆了多少框架”，而是：

`我把一个健康管理场景，做成了一个真正可运行、可解释、可演示、可继续迭代的 Agent 应用。`
