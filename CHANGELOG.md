# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/) · 版本号遵循 [SemVer](https://semver.org/)

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
