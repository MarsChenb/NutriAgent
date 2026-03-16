# NutriAgent 技术白皮书

## 1. 项目概述

### 1.1 项目定位

- 一个面向健康管理场景的移动端优先 AI Agent Web 应用
- 目标岗位：AI 应用开发、LLM 应用工程、Agent 开发
- 核心价值：把真实业务闭环和可讲清楚的 Agent 架构结合起来

### 1.2 用户闭环

```text
选择教练
-> 移动端建档
-> 今日健康工作台
-> 餐食 / 运动记录
-> Agent 拆解任务并执行
-> 周计划 / 周复盘
```

### 1.3 项目边界

- 当前是单用户模式
- 当前重点是任务型 Agent，而不是通用多智能体平台
- 当前评估体系是最小可用版本，适合本地回归，不是线上平台级评估系统

## 2. 整体架构

### 2.1 系统架构图

```text
Frontend (Next.js)
-> API Layer (FastAPI)
-> Agent Layer (Router / Planner / Clarifier / Executor / Memory)
-> Domain Services (meals / exercises / health / rag / recipe)
-> PostgreSQL / pgvector
```

### 2.2 前端架构

- 移动端优先布局
- 工作台式首页
- 一题一屏建档
- Agent Studio 聊天页
- 周计划 / 周复盘页

### 2.3 后端架构

- FastAPI 提供 API
- SQLAlchemy Async 管理数据库访问
- Agent 流程由 `graph.py` 收束
- 业务能力通过 Tool Registry 暴露给 Agent

## 3. Agent 设计

### 3.1 为什么不是普通聊天系统

- 健康管理是任务链，不是泛问答
- 高价值请求通常是复合任务
- 必须把“记录、分析、推荐、复盘”串成一条链

### 3.2 Agent 主链路

```text
User Input
-> Router
-> Direct / Planned / Clarification
-> Planner
-> Tool Registry
-> Executor
-> Final Response
```

### 3.3 Router

- 作用
- 输入
- 输出
- LLM 路由与规则兜底的取舍

### 3.4 Planner

- 复杂任务识别方式
- 计划步骤结构
- 计划模式与单步模式的边界

### 3.5 Clarifier

- 触发条件
- 缺失字段类型
- 如何和短期记忆配合

### 3.6 Executor 与 Tool Registry

- Tool schema
- Tool invoke 过程
- 错误处理
- trace 生成

## 4. 记忆体系

### 4.1 短期记忆

- `conversation_id`
- 最近会话消息
- 澄清追问的续接

### 4.2 长期记忆

- 目标
- 口味偏好
- 过敏和饮食限制
- 健康史
- 活动水平

### 4.3 Memory Read / Write 策略

- 什么该记
- 什么不该记
- 为什么不做全量盲注

## 5. 核心工具能力

### 5.1 餐食工具

- 文本解析
- 图片识别
- 餐食保存
- 每日汇总

### 5.2 运动工具

- 运动记录
- 运动汇总

### 5.3 知识工具

- 轻量 RAG
- 知识片段检索

### 5.4 推荐工具

- 食谱推荐
- 预算相关建议

## 6. 前端设计与产品化

### 6.1 为什么做成移动端优先

- 健康管理是高频轻操作场景
- 更适合作品展示和录屏
- 更容易形成产品感

### 6.2 页面信息架构

- 首页
- 建档
- 记餐
- 运动记录
- Agent Studio
- 周计划 / 周复盘

### 6.3 视觉系统

- 设计 token
- 色彩和圆角
- 底部固定操作区
- 卡片化布局

## 7. 数据与业务建模

### 7.1 核心实体

- UserProfile
- MealLog / MealItem
- ExerciseLog
- DailySummary
- WeightLog
- LongTermMemory
- ConversationHistory

### 7.2 业务闭环

- 餐食如何影响预算
- 运动如何影响缺口
- 周复盘如何汇总阶段性表现

## 8. 评估与验证

### 8.1 当前验证方式

- 前端 build
- 后端 compileall
- Planner / Memory / Evaluation 单测

### 8.2 Agent 最小评估指标

- intent_accuracy
- plan_mode_accuracy
- tool_selection_accuracy
- clarification_accuracy

### 8.3 评估结论

- 当前结果
- 哪些指标说明 Agent 骨架已经可用
- 哪些指标仍不足以证明线上稳定性

## 9. 固定 Demo 场景

参考 [DEMO_SCENARIO.md](/d:/NutriAgent/DEMO_SCENARIO.md)

### 9.1 演示目标

### 9.2 演示步骤

### 9.3 每一步要讲什么

### 9.4 常见面试追问

## 10. 面试重点

### 10.1 项目介绍 3 分钟版

### 10.2 项目介绍 8 分钟版

### 10.3 常见深挖问题

- 为什么不是多 Agent 协商架构
- 为什么先做单用户模式
- 为什么需要 Clarification
- 为什么 trace 要对前端可见
- 为什么记忆只注入精选片段

## 11. 诚实可讲的不足

- 不是平台级多租户系统
- 评估体系是最小版本
- 目前没有完整的线上观测平台
- 规则路由仍然偏轻量
- 长期记忆还没有做更细的生命周期管理

## 12. 后续演进方向

- 更丰富的工具与复杂任务
- 更系统的 trace 查询与开发态面板
- 更完整的评估 case 和自动回归
- 更强的长期记忆更新策略
- 更接近真实产品的数据同步能力
