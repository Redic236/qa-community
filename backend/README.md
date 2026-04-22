# 问答社区 · 后端

## 技术栈

- Node.js 18+ / TypeScript 5.x
- Express 4
- Sequelize 6 + MySQL 8（开发/生产）
- SQLite in-memory（单元测试）
- Jest + ts-jest

## 目录结构

```
backend/
├── src/
│   ├── config/           # 环境变量、Sequelize 连接
│   ├── models/           # User / Question / Answer / Vote / PointRecord
│   ├── services/         # PointsService + 业务 Service
│   ├── utils/            # 常量、错误类型
│   ├── __tests__/        # 集成测试
│   └── app.ts            # Express 入口
├── .env.example
├── jest.config.js
├── package.json
└── tsconfig.json
```

## 启动

```bash
cd backend
npm install
cp .env.example .env   # 填真实 DB 密码 / JWT_SECRET
npm run db:setup       # 一次性：建库 + 跑所有迁移
npm run dev            # 开发模式（tsx watch）
npm test               # 运行测试（SQLite in-memory，自动 sync 表结构）
npm run smoke          # 端到端冒烟（SQLite in-memory，打印每个端点响应）
```

**其他运维脚本**
| 命令 | 作用 |
|---|---|
| `npm run db:create` | 确保 `DB_NAME` 数据库存在（`CREATE DATABASE IF NOT EXISTS`） |
| `npm run db:inspect` | 列出当前数据库里所有表 |

## 数据库迁移

**不再使用 `sequelize.sync()`**（除测试外）。开发/生产表结构由 `migrations/` 目录下的 TS 迁移文件管理，通过 [umzug](https://github.com/sequelize/umzug) 执行。

| 命令 | 作用 |
|---|---|
| `npm run db:migrate` | 应用所有待执行迁移 |
| `npm run db:migrate:down` | 回滚最近一次迁移 |
| `npm run db:migrate:status` | 查看已执行 / 待执行列表 |

元数据存在 `sequelize_meta` 表。迁移文件命名 `YYYYMMDDHHMMSS-name.ts`，导出 `up(queryInterface)` 和 `down(queryInterface)`。

**环境分层**
- `NODE_ENV=test` → SQLite in-memory，Jest 用 `sync({force:true})`，**不跑**迁移。
- `NODE_ENV=development` / `production` → MySQL，必须手动 `npm run db:migrate`。若 `users` 表不存在，启动时会打印警告。

**新增迁移**

```bash
# 新建文件（手工命名）
touch migrations/$(date -u +%Y%m%d%H%M%S)-add-xxx.ts
# 文件里实现 up/down，再执行
npm run db:migrate
```

## 积分系统

详见 [docs/points.md](./docs/points.md)（后续可补）。规则概要：

| 操作 | 积分 | type 枚举 |
|---|---:|---|
| 发布问题 | -5 | `ask` |
| 回答问题 | +10 | `answer` |
| 回答被采纳 | +30 | `accept` |
| 问题被点赞 | +5 | `like_question` |
| 回答被点赞 | +10 | `like_answer` |

### 行为约定

- **原子性**：每次积分变动与触发事件（发问/答题/点赞/采纳）在同一个 Sequelize 事务内完成。
- **可审计**：`point_records` 采用"追加式账本"（append-only ledger），`user.points` 始终等于该用户所有记录之和。
- **对冲规则**：
  - 取消点赞 → 向作者写入反向记录（例如问题取消点赞 = `-5`）。
  - 切换采纳答案 → 新作者 `+30`；旧采纳作者**保留** `+30`（一次采纳奖励永久记入）。
- **防刷**：自己给自己点赞/采纳不产生积分。
- **允许负积分**：新用户初始 0 分即可发问（变为 `-5`），后续如需门槛可在 `QuestionService.create` 前加最低余额校验。

## REST API

所有响应统一为 `{ success: boolean, data?, error?, details? }` 格式。

### 认证
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/api/auth/register` | - | `{ username, email, password }` → `{ user, token }` |
| POST | `/api/auth/login` | - | `{ email, password }` → `{ user, token }` |
| GET  | `/api/auth/me` | Bearer | 当前用户 |

### 问题
| 方法 | 路径 | 鉴权 | 积分影响 |
|---|---|---|---|
| POST | `/api/questions` | Bearer | 作者 **-5** |
| GET  | `/api/questions` | - | - |
| GET  | `/api/questions/:id` | 可选 | - |

**`GET /api/questions` query 参数**（Zod 校验，不合法返回 400）：

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `sort` | `latest` \| `popular` \| `unsolved` | `latest` | 排序/过滤模式 |
| `tag` | string (1-50) | - | 按标签精确过滤（带引号子串匹配，`java` ≠ `javascript`） |
| `page` | int ≥ 1 | `1` | 页码 |
| `limit` | int 1-50 | `20` | 每页条数 |

响应：`{ success, data: Question[], meta: { total, page, limit } }`

### 回答
| 方法 | 路径 | 鉴权 | 积分影响 |
|---|---|---|---|
| POST | `/api/questions/:questionId/answers` | Bearer | 作者 **+10** |
| POST | `/api/answers/:id/accept` | Bearer（仅问题作者） | 答案作者 **+30**（自答不加分） |

### 点赞（toggle）
| 方法 | 路径 | 鉴权 | 积分影响 |
|---|---|---|---|
| POST | `/api/votes` | Bearer | 点赞问题作者 **+5**，点赞回答作者 **+10**；取消点赞反向扣除；自赞不加分 |

请求体：`{ targetType: 'question' | 'answer', targetId: number }`

### 错误码约定
- `400` Zod 校验失败（带 `details`）或业务约束
- `401` 缺少 / 无效 token，或登录失败
- `403` 越权（如非问题作者尝试采纳）
- `404` 资源不存在
- `409` 冲突（如答案已被采纳）

## 边界约束（PRD §8）

### 内容审核
- [ModerationService](src/services/ModerationService.ts) 在问题/回答 create/update 入口处做关键词黑名单匹配，命中即 400。
- 默认黑名单是少量 CN-spam beacon；用 env `BANNED_WORDS=a,b,c` 可整体覆盖（生产里可挂自动同步脚本 / 接 ML 分类器）。
- 用户名、tag 等未做审核——下一轮再说。

### 每日积分上限
- 同一用户 24h 内（按 UTC 日历分界）能从**被动来源**（问题被赞 / 回答被赞 / 答案被采纳）获得的正积分总额上限。
- 默认 100 分；env `DAILY_PASSIVE_POINTS_CAP=N` 可调，`=0` 关闭。
- 主动行为（发问 -5、答题 +10）**不受限**。
- 行为：超限的 vote/accept 仍会成功（counter 仍 +1，is_accepted 仍翻转），但**不写积分记录**。账本恒等式 `user.points ≡ Σ point_records.points` 仍成立。

### 速率限制
仅在 `NODE_ENV=production` 启用（dev/test 默认跳过，避免开发节奏受阻）。本地想验证拦截行为时设 `RATE_LIMIT_FORCE=1` 强制开启。

| 端点 | 限制 | 键 |
|---|---|---|
| `POST /api/auth/register`、`/login` | 20 / 15 分钟 | IP |
| `POST/PATCH` 问题、回答 | 30 / 小时 | userId |
| `POST /api/votes` | 60 / 分钟 | userId |

返回 `429` + `{ success: false, error: '请求过于频繁，请稍后再试' }` 并附 `RateLimit-*` 标准响应头。

## 后续待补

- 标签表与问题-标签关联表（目前 `questions.tags` 存 JSON 数组）
- winston 日志、CSP 响应头
- 内容审核分级（举报、人工复审队列、ML 分类器）
- Redis 后端的 rate-limit store（多实例部署前必做）
