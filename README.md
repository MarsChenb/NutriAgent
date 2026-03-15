# NutriAgent - AI 健康教练 Web 应用

NutriAgent 是一个面向减脂与健康管理场景的单用户 AI 应用项目。它把竞品中的核心闭环拆成一个更适合 Web 演示和面试表达的版本：`首次建档 -> 每日执行 -> AI 私教 -> 周度复盘`。

项目定位不是商业化 SaaS，而是一个可完整演示的 AI 应用作品，重点体现：
- 多模态餐食记录
- 个性化健康画像
- AI 私教任务型交互
- 饮食 + 运动能量平衡计算
- 周度复盘与 AI 总结

## 适合演示的核心功能

### 1. 首次建档与教练人格选择
- 选择 3 位不同风格的 AI 教练
- 分 9 步采集个人画像：目标、性别、年龄、身高、当前体重、目标体重、体型、运动习惯、疾病史
- 实时计算 BMI 与目标减重差值

### 2. 今日健康工作台
- 按日期查看每日饮食与运动数据
- 展示热量预算、饮食摄入、运动消耗、热量缺口
- 按早餐 / 午餐 / 晚餐 / 加餐 / 运动组织当天记录

### 3. 多模态餐食记录
- 支持文本描述解析
- 支持图片上传识别
- 解析后展示食物项、克数、总热量、三大营养素
- 保存后生成 AI 简评并回流首页展示

### 4. 运动记录与能量平衡
- 手动记录运动类型、时长、消耗热量、备注
- 自动汇总到每日热量缺口
- 保存后生成 AI 运动点评

### 5. AI 私教工具台
- 保留自由聊天
- 提供快捷任务：查食物热量、推荐饮食、训练后怎么吃、今天还能吃什么
- 注入用户画像、今日预算、最近餐食与最近运动作为上下文
- 回答风格随教练人格变化

### 6. 周度复盘页
- 展示最近 7 天饮食摄入、运动消耗、热量缺口、体重变化
- 每日标记执行状态：达标 / 未达标 / 数据不足
- 页面顶部生成 AI 周总结，输出本周表现、问题与下周建议

## 项目截图建议

如果你准备录屏或写作品集，建议截这 5 类页面：
1. 教练选择 + 9 步建档
2. 今日健康工作台首页
3. 餐食识别结果页
4. AI 私教工具台
5. 周度复盘页

## 技术亮点

- 前端：Next.js App Router + TypeScript + Tailwind CSS
- 后端：FastAPI + SQLAlchemy Async
- 大模型接入：DeepSeek OpenAI 兼容接口
- AI 交互：任务型路由 + Persona Prompt + Context Engineering
- 数据层：餐食、运动、日汇总、体重记录四类核心实体联动

## 项目结构

```text
NutriAgent/
├── backend/
│   ├── app/
│   │   ├── agents/             # 私教对话路由、Prompt、上下文组装
│   │   ├── api/v1/             # meals / exercises / health / chat 等接口
│   │   ├── models/             # 用户、餐食、运动、体重、日汇总模型
│   │   ├── schemas/            # Pydantic 请求与响应模型
│   │   ├── services/           # 餐食汇总、运动汇总等业务逻辑
│   │   ├── rag/                # RAG 检索与知识导入
│   │   └── vision/             # 图片食物识别
│   └── seeds/                  # 食物和知识库种子数据
└── frontend/
    └── src/app/
        ├── page.tsx            # 今日健康工作台
        ├── onboarding/         # 教练选择 + 首次建档
        ├── meals/              # 文本/图片餐食记录
        ├── exercise/           # 手动运动记录
        ├── chat/               # AI 私教工具台
        └── review/             # 周度复盘页
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

访问 `http://localhost:3000`。

## 关键接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/v1/users/me/profile` | 获取单用户画像 |
| `POST` | `/api/v1/meals/parse` | 文本餐食解析 |
| `POST` | `/api/v1/meals/image` | 图片餐食识别 |
| `POST` | `/api/v1/meals/` | 保存餐食记录 |
| `GET` | `/api/v1/meals/daily-summary` | 获取每日营养与热量汇总 |
| `POST` | `/api/v1/exercises/` | 保存运动记录 |
| `GET` | `/api/v1/exercises/` | 获取某日运动记录 |
| `POST` | `/api/v1/chat/` | AI 私教统一对话入口 |
| `POST` | `/api/v1/health/weight` | 记录体重 |
| `GET` | `/api/v1/health/weekly-review` | 获取最近 7 天周复盘 |

## 面试可讲的设计点

### 1. 为什么做成单用户模式
为了聚焦 AI 应用本身，把登录、多租户、权限和商业化逻辑从主线剥离，优先做完整用户闭环与高质量交互体验。

### 2. 为什么聊天页不是普通聊天框
把高频任务入口前置，降低用户提问成本；后端先做意图识别与上下文组装，再按任务路由给模型，能明显提高回答相关性。

### 3. 为什么要有周复盘页
作品集项目如果只有“记录”没有“复盘”，完成度会明显不足。周复盘把短期记录转成阶段性结果，更适合演示和讲业务闭环。

## 简历一句话版本

一个面向减脂场景的 AI 健康教练 Web 应用，支持首次建档、多模态餐食识别、运动记录、热量缺口计算、AI 私教任务型对话与周度复盘。
