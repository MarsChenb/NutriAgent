# NutriAgent — AI 智能营养管理系统

基于 Multi-Agent 架构与 RAG 的智能饮食管理系统，实现 **记录饮食 → 识别食物 → 估算热量 → 分析营养 → 个性化建议 → 长期追踪** 的完整闭环。

## 技术亮点

- **Multi-Agent 编排**：Router Agent 自动分流到 食物解析 / 营养查询 / 知识问答 / 食谱推荐 等子 Agent
- **RAG 营养知识库**：基于 pgvector 向量检索，结合《中国居民膳食指南》等权威知识回答营养问题
- **Text2SQL**：自然语言查询饮食记录和营养数据
- **食物识别**：文字描述解析 + 图片识别（多模态）
- **个性化推荐**：结合用户画像、当日摄入量、健康目标进行食谱推荐

## 技术栈

| 层 | 技术 |
|---|---|
| LLM | DeepSeek API（OpenAI 兼容接口） |
| 后端 | FastAPI + SQLAlchemy 2.0 (async) + Alembic |
| Agent | LangGraph 状态机 + 多 Agent 协作 |
| 向量库 | PostgreSQL + pgvector |
| 缓存 | Redis |
| 前端 | Next.js 14 + TypeScript + Tailwind CSS |
| 基础设施 | Docker Compose |

## 项目结构

```
NutriAgent/
├── docker-compose.yml          # PostgreSQL (pgvector) + Redis
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI 入口
│   │   ├── config.py           # 配置管理
│   │   ├── api/v1/             # REST API 端点
│   │   │   ├── auth.py         # JWT 认证
│   │   │   ├── meals.py        # 饮食记录 CRUD + AI 解析
│   │   │   ├── chat.py         # AI 对话（统一入口）
│   │   │   ├── foods.py        # 食物库搜索
│   │   │   └── health.py       # 体重记录
│   │   ├── agents/             # Multi-Agent 系统
│   │   │   ├── graph.py        # Agent 编排主流程
│   │   │   ├── router_agent.py # 意图分类
│   │   │   ├── food_parser.py  # LLM 食物解析
│   │   │   ├── sql_agent.py    # 数据库查询
│   │   │   ├── nutrition_agent.py  # 营养分析
│   │   │   ├── recipe_agent.py # 食谱推荐
│   │   │   └── rag_agent.py    # RAG 问答
│   │   ├── rag/                # RAG 管线
│   │   │   ├── embeddings.py   # Embedding 生成
│   │   │   ├── ingestion.py    # 文档切块 + 向量化
│   │   │   └── retriever.py    # 向量检索
│   │   ├── models/             # ORM 模型
│   │   ├── schemas/            # Pydantic 校验
│   │   ├── services/           # 业务逻辑
│   │   └── vision/             # 图片食物识别
│   └── seeds/                  # 种子数据
│       ├── chinese_foods.json  # 51 种中国常见食物
│       └── knowledge/          # RAG 知识文档
├── frontend/
│   └── src/app/
│       ├── page.tsx            # Dashboard（热量环形图）
│       ├── meals/page.tsx      # 饮食记录
│       └── chat/page.tsx       # AI 对话
```

## 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <repo-url> && cd NutriAgent

# 复制环境变量
cp .env.example backend/.env

# 编辑 backend/.env，填入你的 DeepSeek API Key
# DEEPSEEK_API_KEY=your_actual_key
```

### 2. 启动基础设施

```bash
# 启动 PostgreSQL (pgvector) + Redis
docker-compose up -d
```

### 3. 启动后端

```bash
cd backend

# 使用 Conda 创建并激活环境
conda env create -f environment.yml
conda activate nutriagent-backend

# 如果已经创建过环境，只需要激活
# conda activate nutriagent-backend

# 加载种子数据（首次运行）
python seeds/load_seeds.py

# 导入 RAG 知识库（首次运行）
python -c "import asyncio; from app.rag.ingestion import ingest_all; asyncio.run(ingest_all())"

# 启动 API 服务
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### 4. 启动前端

```bash
cd frontend
# 本地开发时让前端指向 8001 后端
# Windows:
set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001/api/v1
# macOS/Linux:
# export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001/api/v1
npm install
npm run dev
```

访问 http://localhost:3000 开始使用。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/register` | 用户注册 |
| POST | `/api/v1/auth/login` | 用户登录 |
| PUT | `/api/v1/users/me/profile` | 更新用户画像 |
| GET | `/api/v1/foods/?q=` | 搜索食物库 |
| POST | `/api/v1/meals/` | 创建饮食记录 |
| POST | `/api/v1/meals/parse` | AI 解析饮食文字 |
| POST | `/api/v1/meals/image` | 图片食物识别 |
| GET | `/api/v1/meals/daily-summary` | 每日营养汇总 |
| POST | `/api/v1/chat/` | AI 对话（统一入口） |
| POST | `/api/v1/health/weight` | 记录体重 |

Swagger 文档：http://127.0.0.1:8001/docs

## Agent 工作流

```
用户消息 → Router Agent（意图分类）
  ├── log_meal      → 食物解析 → 数据库匹配 → 记录 → 营养分析
  ├── query_nutrition → SQL 查询 → 汇总展示
  ├── ask_knowledge  → RAG 向量检索 → LLM 生成回答
  ├── recommend_recipe → 读取画像 + 剩余热量 → 个性化推荐
  └── general_chat   → 直接 LLM 回答
```

## 核心功能演示

1. **记录饮食**："我中午吃了两碗米饭和一个鸡腿" → 自动解析 + 热量计算 + 营养分析
2. **查询汇总**："今天吃了多少热量" → 返回今日摄入 vs 目标
3. **知识问答**："减脂期间主食应该怎么选" → RAG 检索膳食指南回答
4. **食谱推荐**："推荐一顿500卡的晚餐" → 结合个人画像推荐
5. **Dashboard**：热量环形图 + 宏量营养素进度 + 餐食列表

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接 | `postgresql+asyncpg://nutriagent:nutriagent123@localhost:5432/nutriagent` |
| `REDIS_URL` | Redis 连接 | `redis://localhost:6379/0` |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | （必填） |
| `DEEPSEEK_BASE_URL` | API 地址 | `https://api.deepseek.com/v1` |
| `JWT_SECRET_KEY` | JWT 签名密钥 | `nutriagent-secret-key-change-in-production` |
