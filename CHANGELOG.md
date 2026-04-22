# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/) · 版本号遵循 [SemVer](https://semver.org/)

## [1.1.1] — 2026-04-22

收尾 v1.0.0 代码审查里剩余的 3 项 UX / 暗色模式 polish。纯前端改动，无 API / DB 变更。

### 用户体验（UX）

- **未保存草稿保护**：AskQuestionPage 和 QuestionDetailPage 回答框在用户改动表单后注册 `beforeunload` 监听；关闭标签页 / 刷新 / 输入新 URL 会触发浏览器原生"离开此页？"对话框。react-router 内跳转（发布成功后 `navigate(...)`）不受影响
- **相对时间显示**：问题列表 / 问题详情 / 评论 / 通知 / 个人主页问题列表的时间戳改成 "3 分钟前" / "3 minutes ago"，跟随 i18n 语言切换；鼠标悬浮显示完整绝对时间戳
- **recharts 暗色模式**：AdminDashboardPage 的 LineChart / BarChart Tooltip 和 Legend 颜色改走 `theme.useToken()`；补上 v1.1.0 里 grid + axis 暗色化的最后一块

### 开发体验

- **显式 dayjs 依赖**：antd 是 peer 传递引入的，避免未来 antd 换日期库时代码静默坏掉

### 新增文件

```
frontend/src/hooks/useUnsavedChangesWarning.ts
frontend/src/components/TimeAgo.tsx
frontend/src/utils/time.ts
```

### 验证

- 前端 tsc + vite build 通过（+dayjs 约 +2KB gzip）
- E2E 20/20 通过

---

## [1.1.0] — 2026-04-22

从 v1.0.0 代码审查的 MEDIUM / LOW / UX 清单里挑了 12 项硬化 + 性能 + 体验改进。
无 API 破坏性变更；新增 1 条 migration（users.points 索引）。

### 修复 / 硬化（Changed）

- **FollowService.toggle 幂等化**：改 `Follow.findOrCreate`；双击 / 多标签并发 follow 不再因 unique 约束 500
- **CommentService.delete 事务化**：整个 load → authz → cascade → delete 包在一个事务，消除中间脏读窗口
- **NotificationStream publish 失败不再本地兜底**：Redis ACK 丢失 ≠ 消息丢失，本地 fanout 会导致所有在线客户端收到重复事件。现在只记日志
- **errorHandler 生产环境不透 Zod `fieldErrors`**：仅 `NODE_ENV !== 'production'` 时附带 `details`，避免向攻击者暴露 schema 形状
- **schemas 加 content `.max(20000)`**：question / answer 内容长度上限；评论已有 500；防止超大 payload 拖慢缓存 + SSE 广播
- **bcrypt `SALT_ROUNDS` 10 → 12**：OWASP 2024 推荐值；新增 `BCRYPT_ROUNDS` 环境变量方便调整（测试用 4 以保持速度）

### 性能（Performance）

- **AdminStatsService SQL GROUP BY**：每日趋势由"拉全部行 + JS 分桶"改为 `SELECT DATE(...) AS day, COUNT(*) GROUP BY day` — 数据库层聚合，结果行数为天数上限（7/30/90），不再随表规模增长
- **AdminStatsService 标签统计加 Redis 缓存**：5 分钟 TTL；Question `LIMIT 10000` 防止极端表规模拖慢首次计算
- **AchievementService.listFor 加 Redis 缓存**：每用户 60s 缓存；解锁时自动失效；原本每次 profile 页请求跑 5 次 metric 聚合查询，现在空闲浏览期几乎零 DB 压力
- **SSE 每用户连接上限 5 条**：超出返回 429；防止恶意脚本用无限 EventSource 耗尽内存（每连接持 25s 心跳定时器）
- **users.points 索引**：支撑 `ORDER BY points DESC` 扫描（leaderboard / admin top-users）；新 migration + User 模型同步

### 用户体验（UX）

- **401 自动退出加 "会话过期" 提示**：RTK Query baseQuery 检测 401 时先 `message.warning(t('errors.sessionExpired'))` 再 `dispatch(logout())`；避免用户被静默踢出不知所以
- **首页自点赞按钮 `cursor: not-allowed`**：内容作者悬停自己问题的点赞按钮时鼠标变禁用样式，对应 tooltip 的"不能给自己点赞"

### 开发体验

- **jest 用 `BCRYPT_ROUNDS=4`**：测试套件从 ~55s 恢复到 ~8s（bcrypt 12 的开销太大）

### Migration

```
20260422000005-users-points-index.ts  # CREATE INDEX ON users(points)
```

### 验证

- 后端 tsc + 148 Jest 全绿
- E2E 20/20 通过
- 前端 tsc 通过
- dev MySQL 已应用新 migration

---

## [1.0.1] — 2026-04-22

安全补丁版本。v1.0.0 代码审查中发现的 7 项 CRITICAL/HIGH 问题修复。

### 修复（Security）

- **JWT_SECRET 生产兜底**：`NODE_ENV=production` 时若 `JWT_SECRET` 未设置或仍为 dev 默认值 `'dev-secret-change-me'`，启动即 throw；防漏配导致任意 admin token 伪造（`backend/src/config/env.ts`）
- **requireAdmin 二段校验**：除 JWT role claim 外，再查 DB 核实当前 role；降权 admin 7 天内持旧 token 通过的问题消除（`backend/src/middleware/auth.ts`）
- **VoteService 并发 race**：改 `Vote.findOrCreate` 原子 toggle；双击 / 双标签同时点赞不再因 unique 约束 500（`backend/src/services/VoteService.ts`）
- **PointsService cap 并发穿透**：`award` 内对 user 行 `SELECT ... FOR UPDATE`；两个 like 同秒到达不再各自读 195→各写 5→ 205 越过 cap（`backend/src/services/PointsService.ts`）
- **SSE ticket 认证**：新增 `POST /api/notifications/stream/ticket`（Bearer 认证 → 30s 一次性票据）；`/stream?ticket=...` 消费票据。移除原 `?token=<JWT>` 方式，杜绝 JWT 进 nginx access log / proxy / Referer（`backend/src/services/SseTicketService.ts`、`backend/src/controllers/NotificationController.ts`、`frontend/src/hooks/useNotificationStream.ts`）
- **rateLimit 默认开**：仅 `NODE_ENV` ∈ {test, development} 时跳过；staging / 未设 NODE_ENV 的环境现有保护。`RATE_LIMIT_DISABLE=1` 为显式逃生口（`backend/src/middleware/rateLimit.ts`）
- **helmet + CORS 白名单**：加 `helmet()`（X-Content-Type-Options、Referrer-Policy、等）+ `cors({ origin: ALLOWED_ORIGINS })`；生产经 env 声明合法 origin。`express.json({ limit: '100kb' })` 限制请求体大小（`backend/src/app.ts`）

### 其他变更

- `.env.example` 补 `ALLOWED_ORIGINS` 和 `RATE_LIMIT_DISABLE` 说明

### 验证

- 后端 tsc + 148 Jest 全绿
- E2E 20/20 通过
- 前端 tsc 通过

---

## [1.0.0] — 2026-04-22

问答社区首个稳定版本。PRD P0 + P1 全部落地 + 6 轮功能扩展 + 多轮性能/体验优化。

### 新增（Added）

**核心业务**
- 用户注册 / 登录 / JWT 鉴权 / 个人资料编辑
- 提问 / 回答 / 点赞 / 采纳 / 取消采纳
- 积分系统：发问 −5、回答 +10、被采纳 +30、被点赞 +5；每日被动积分上限
- 评论系统（问题下 + 每个回答下），支持 2 层回复线
- 举报 + 管理员审核后台（保留 / 删除内容并关闭相关举报）
- 通知系统：8 种事件类型，SSE 实时推送（Redis pub/sub 多实例可用），铃铛未读角标
- 国际化 i18n：中文 / 英文切换（前端 UI + 后端 API 错误）

**社交 + 激励**
- 关注体系：关注问题 / 关注用户，扇出通知给粉丝
- 公开排行榜：用户榜（终身积分）+ 问题榜（7/30/90 天窗口）
- 10 档徽章成就（铜 / 银 / 金），事件驱动自动解锁
- 用户等级（5 档，基于累计积分）

**管理员**
- 数据看板：KPI 卡片 + 近 7/30/90 天趋势折线图 + Top 10 用户 / 标签
- 举报审核：三态 Tab（待处理 / 已保留 / 已删除）

**搜索**
- 关键词搜索（标题 + 内容），MySQL FULLTEXT + ngram 分词器（支持中文）
- 标签筛选（大小写不敏感、防前缀冲突）
- 三种排序：最新 / 热门 / 未解决

**基础设施**
- MySQL 8（生产）+ SQLite in-memory（测试）双数据库
- Umzug 迁移：7 条（init / roles-reports / comments-notifications / comment-threading / follows / questions-fulltext / achievements）
- Redis（可选）：缓存 + 速率限 store + SSE pub/sub
- 速率限制：auth / write / vote 三档（仅 production 生效）
- 内容审核：关键词黑名单（环境变量可扩展）
- HTTP：list 接口 ETag + `Cache-Control: private, must-revalidate` + `Vary: Authorization, Accept-Language`

**运维**
- Docker Compose 一键栈（MySQL + Redis + 后端 + nginx 前端反代）
- nginx 配置 SSE-safe（buffering off，24h timeout）
- GitHub Actions CI：backend（tsc + jest）/ frontend（build）/ e2e（Playwright）三 job 并行
- GitHub Actions Release：push main / tag v*.*.* → GHCR 自动构建推送 backend + frontend 镜像

**测试**
- 后端 Jest：148 用例（api + PointsService + NotificationStream + QuestionSearch）
- E2E Playwright：20 用例（auth / questions / answers + voting / profile）
- 后端 smoke：23 步 supertest（SQLite 或 dev MySQL 双模式）

### 性能（Performance）

- Vite `manualChunks` 拆 vendor：react / antd / recharts / redux / form / i18n / icons 独立 chunk
- 路由级 `React.lazy()` + `Suspense`：非 home 页懒加载
- 首次访问匿名首页：从 574 KB gzip → ~470 KB gzip（-18%）；recharts 仅 admin 触达时下载
- hover prefetch：导航菜单 / 下拉 / 问题标题 hover 时预热目标 chunk
- 乐观更新：点赞 + 关注按钮即时反转，不等服务器
- RTK Query `keepUnusedDataFor` 调优：列表 / 排行榜 5 分钟，详情 2 分钟
- Service Worker（VitePWA）：预缓存 23 个构建产物（~1.83 MB），二次访问近 0 网络
- List 接口 ETag → If-None-Match 304 命中
- 详情页 Redis 缓存 + 版本无关失效

### 用户体验（UX）

- 暗色模式（跟随 OS 偏好 + localStorage 持久化）
- `/` 快捷键聚焦首页搜索（GitHub 风格）
- 路由切换自动回到顶部
- ErrorBoundary 兜底：运行时异常展示 Result + 重试，不白屏
- 响应式：Grid.useBreakpoint 驱动的移动端布局
- 骨架屏贴合真实行布局（非通用卡片）
- 空状态统一：EmptyState 组件 + 场景化 CTA

### 安全（Security）

- JWT 签名验证 + 过期
- bcryptjs 密码哈希
- Zod schema 全量入参校验
- 参数化 ORM（无 SQL 拼接）
- BOOLEAN MODE 搜索输入净化（防 MATCH 注入）
- admin 路由双层：requireAuth + requireAdmin（JWT role claim）
- CORS 显式配置
- 不暴露邮箱 / 密码哈希到任何公开接口

### 已知限制

- Markdown 渲染未实现（问答仍为纯文本）
- 头像仅支持 URL 填写，未接入上传
- SSR / SEO 未做（纯 SPA）
- MySQL `ngram_token_size` 默认 2，单字搜索走 LIKE 回退
- SSE 多实例需 Redis；单实例部署回退本地 fanout

---

## 初始里程碑

- `0383f7b` 文档 + PRD + 技术设计 + 项目骨架
- `1ec9380` 后端骨架（Express + Sequelize + TS）
- `6d007de` 前端初始化（Vite + React + AntD + RTK Query）
- `2b82ee2` E2E 测试（Playwright 20 用例）
- `3b652d6` Docker Compose + CI/CD workflows
- `ddd34be` 跨平台 .gitattributes
- `d1d1f33` CONTRIBUTING.md（分支模型 + 提交规范）
