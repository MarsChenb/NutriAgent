# NutriAgent

一个面向减脂与健康管理场景的移动端优先 AI Agent Web 应用。

NutriAgent 不是通用聊天 Demo，也不是拼概念的“多 Agent 壳”。它围绕真实健康场景，把 `首次建档 -> 每日执行 -> Agent 私教 -> 周计划 / 周复盘` 做成了一个可完整演示的产品闭环。

当前版本重点体现三件事：

- 移动端优先的 AI 健康教练产品体验
- 多模态记录、能量平衡计算与个性化建议
- Router + Planner + Executor 驱动的任务型 Agent 工作流

## 项目定位

这个项目适合用于：

- AI 应用开发岗位
- Agent 开发 / LLM 应用工程岗位
- 作品集展示、录屏演示、面试讲解

它不追求商业化 SaaS 完整度，而是强调：

- 有真实业务闭环
- 有可讲清楚的 Agent 架构
- 有能截图和演示的产品形态
- 有前后端一体化落地能力

## 当前主流程

```text
选择教练
-> 9 步移动端建档
-> 今日健康工作台
-> 文本 / 图片记录餐食
-> 手动记录运动
-> Agent 私教拆解任务并执行
-> 查看周计划 / 周复盘
```

## 核心能力

### 1. 移动端建档与教练人格选择

- 支持 3 位不同风格的 AI 教练
- 分 9 步采集目标、性别、年龄、身高、体重、体型、运动习惯、健康史
- 实时计算 BMI 与目标体重差值
- 页面风格按移动端产品重做，适合录屏和截图

### 2. 今日健康工作台

- 按日期查看当天饮食与运动数据
- 展示剩余热量、饮食摄入、运动消耗、热量缺口、三大营养素进度
- 按早餐 / 午餐 / 晚餐 / 加餐 / 运动组织当天记录
- 底部固定快速记录区，直接连接记餐、拍照和 Agent

### 3. 多模态餐食记录

- 支持自然语言解析餐食
- 支持图片上传识别食物
- 自动换算热量、蛋白质、脂肪、碳水
- 保存后生成 AI 简评并回流首页展示

### 4. 运动记录与能量平衡

- 支持手动记录运动类型、时长、消耗热量、备注
- 自动更新每日热量缺口
- 首页和周复盘会同步展示训练表现

### 5. Agent 私教工具台

- 保留自由对话
- 提供快捷任务入口
- 对复杂任务进行拆解和执行
- 在信息不足时主动澄清追问
- 可折叠查看 plan 和 execution trace

### 6. 周计划 / 周复盘

- 展示最近 7 天饮食摄入、运动消耗、热量缺口、体重变化
- 每日标记达标 / 未达标 / 数据不足
- 顶部输出 AI 周总结
- 支持直接跳转回 Agent 继续追问

## Agent 架构

当前版本把 Agent 主流程收敛成下面这套结构：

```text
User Input
-> Router
-> Direct Mode / Planned Mode / Clarification Mode
-> Planner
-> Tool Registry
-> Executor
-> Summarized Response
-> Frontend shows response + plan + trace
```

### 1. Router

- 先判断用户请求属于哪类任务
- 识别是单步任务还是复合任务

### 2. Planner

- 对复杂任务生成多步 plan
- 每一步显式绑定一个 tool
- 当前重点支持：
  - 记录饮食并分析预算
  - 结合训练推荐一餐
  - 规划今天剩余饮食

### 3. Tool Registry

当前已包装的核心工具包括：

- `log_meal`
- `lookup_food`
- `answer_nutrition`
- `answer_knowledge`
- `recommend_recipe`
- `general_chat`

### 4. Clarifier

- 当任务执行需要更多信息时，不直接瞎答
- 返回结构化追问：
  - `requires_clarification`
  - `clarification_question`
  - `missing_fields`
- 前端会把这类状态渲染成明显的下一步动作

### 5. Execution Trace

每次 Agent 执行都能向前端返回：

- `mode`
- `plan`
- `execution_trace`

这让它不再只是“调个模型接口”，而是具备了可调试、可演示、可解释的 Agent 感。

## 技术栈

### 前端

- Next.js App Router
- TypeScript
- Tailwind CSS
- 移动端优先 UI

### 后端

- FastAPI
- SQLAlchemy Async
- PostgreSQL
- pgvector

### AI / Agent

- DeepSeek OpenAI 兼容接口
- Router + Planner + Executor
- Tool Registry
- Human-in-the-Loop Clarification
- Context Engineering
- 轻量 RAG

## 项目结构

```text
NutriAgent/
├── backend/
│   ├── app/
│   │   ├── agents/             # Planner / Clarifier / Tool Registry / Graph
│   │   ├── api/v1/             # meals / exercises / health / chat / users
│   │   ├── models/             # 用户、餐食、运动、体重、日汇总模型
│   │   ├── schemas/            # 请求与响应模型
│   │   ├── services/           # 餐食与日汇总等业务逻辑
│   │   ├── rag/                # 知识导入与检索
│   │   └── vision/             # 图片食物识别
│   └── tests/                  # Agent planner / clarifier 基础测试
└── frontend/
    └── src/app/
        ├── page.tsx            # 今日健康工作台
        ├── onboarding/         # 教练选择 + 建档流程
        ├── meals/              # 文本 / 图片餐食记录
        ├── exercise/           # 手动运动记录
        ├── chat/               # Agent Studio
        └── review/             # 周计划 / 周复盘
```

## 本地启动

### 1. 启动基础服务

```bash
docker-compose up -d
```

### 2. 启动后端

```bash
cd backend
conda env create -f environment.yml
conda activate nutriagent-backend
python seeds/load_seeds.py
python -c "import asyncio; from app.rag.ingestion import ingest_all; asyncio.run(ingest_all())"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### 3. 启动前端

```bash
cd frontend
npm install

# Windows
set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001/api/v1

# macOS / Linux
# export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001/api/v1

npm run dev
```

访问 `http://localhost:3000`

## 关键接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/v1/users/me/profile` | 获取单用户画像 |
| `PUT` | `/api/v1/users/me/profile` | 更新建档信息 |
| `POST` | `/api/v1/meals/parse` | 文本餐食解析 |
| `POST` | `/api/v1/meals/image` | 图片餐食识别 |
| `POST` | `/api/v1/meals/` | 保存餐食记录 |
| `GET` | `/api/v1/meals/daily-summary` | 获取每日营养与热量汇总 |
| `POST` | `/api/v1/exercises/` | 保存运动记录 |
| `GET` | `/api/v1/exercises/` | 获取某日运动记录 |
| `POST` | `/api/v1/chat/` | Agent 私教统一入口 |
| `GET` | `/api/v1/health/weekly-review` | 获取最近 7 天周复盘 |

## 已完成的验证

### 后端

```bash
python -m compileall backend\app backend\tests
cd backend
python -m unittest tests.test_agent_planner -v
```

### 前端

```bash
cd frontend
npm run build
```

## 推荐演示路径

如果你准备录屏或面试现场演示，建议按这个顺序：

1. 教练选择与移动端建档
2. 今日健康工作台首页
3. 文本或图片记录一餐
4. 进入 Agent Studio 发起复合任务
5. 展示 Agent 的 plan / execution trace
6. 打开周计划 / 周复盘页收束结果

## 面试可讲的重点

### 1. 为什么不是普通聊天应用

因为健康管理场景不是泛问答，用户的真实需求是“记录、判断、推荐、复盘”这一整条任务链，所以我把聊天页设计成了 Agent Studio，而不是单纯聊天框。

### 2. 为什么先做单用户模式

为了先聚焦 AI 应用主线，把登录、多租户、权限和商业化逻辑从主路径上剥离，优先验证用户闭环和 Agent 交互。

### 3. 为什么要有 Clarification

很多健康类任务如果信息不足，直接回答很容易失真。比如记餐时缺餐次和分量、推荐训练后饮食时缺运动上下文，所以我加入了澄清追问而不是让模型硬猜。

### 4. 为什么前端做成移动端优先

健康管理本来就是高频、轻操作、日常记录型场景。移动端优先更符合真实使用方式，也更适合作品展示和演示录屏。

## 简历一句话版本

一个面向健康管理场景的移动端优先 AI Agent Web 应用，支持教练建档、多模态餐食记录、运动记录、热量缺口计算、任务型 Agent 对话与周计划 / 周复盘。
