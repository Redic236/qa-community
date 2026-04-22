# 问答社区

[![CI](https://github.com/Redic236/qa-community/actions/workflows/ci.yml/badge.svg)](https://github.com/Redic236/qa-community/actions/workflows/ci.yml)
[![Release Docker Images](https://github.com/Redic236/qa-community/actions/workflows/release.yml/badge.svg)](https://github.com/Redic236/qa-community/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/Redic236/qa-community?sort=semver)](https://github.com/Redic236/qa-community/releases/latest)

一个完整的问答社区 MVP：发问、回答、点赞、采纳、积分、个人中心。

## 仓库结构

```
.
├── backend/      # Express + Sequelize + MySQL（test 走 SQLite）
├── frontend/     # Vite + React + AntD + Redux Toolkit + RTK Query
├── e2e/          # Playwright 端到端
├── .github/
│   └── workflows/
│       └── ci.yml          # backend / frontend / e2e 三作业
├── PRD文档.md
├── TECH_DESIGN.md
└── database.md
```

## 快速跑起来

### 一键 Docker（推荐）

```bash
cp .env.example .env          # 至少改 JWT_SECRET
docker compose up -d --build
# → http://localhost:8080
```

栈内容：MySQL 8 + Redis 7 + 后端（自动跑迁移）+ 前端（nginx 反代 /api，SSE 已配好不缓冲）。
所有数据落 `mysql_data` / `redis_data` 命名卷，`docker compose down` 不会丢。

升级管理员：

```bash
# 先在前端注册账户，比如 alice@example.com
docker compose exec backend npx tsx scripts/promote-admin.ts alice@example.com
# 让用户重新登录，新 JWT 才带 admin 角色
```

### 直接拉预构建镜像（GHCR）

`.github/workflows/release.yml` 在每次 push 到 main / 打 v*.*.* tag 时自动构建并推送到 GitHub Container Registry：

```bash
docker pull ghcr.io/redic236/qa-community-backend:latest
docker pull ghcr.io/redic236/qa-community-frontend:latest
```

> GHCR 包默认是私有的。首次拉取若提示 `unauthorized`，到 GitHub → 个人 / 组织 → Packages → `qa-community-backend` / `-frontend` → Package settings → Change visibility → Public。改成 Public 之后任何人都可以直接 pull。

可用 tag：`latest`（默认分支）、`sha-<short>`（每次提交）、`<branch>`、`1`、`1.1`、`1.1.1`（对应 semver tag）。所有发行版本见 [Releases 页](https://github.com/Redic236/qa-community/releases)。

想把 `docker-compose.yml` 换成预构建镜像：把 `build:` 段替换为 `image: ghcr.io/redic236/qa-community-backend:latest`（前端同理），跳过本地构建。

### 本地开发（不走 Docker）

**先决条件**：Node 18+、MySQL 8（仅 dev/prod 需要；测试用 SQLite in-memory）。

```bash
# 后端
cd backend
npm install
cp .env.example .env          # 填 DB 密码 / JWT_SECRET
npm run db:setup              # 建库 + 跑迁移
npm run dev                   # http://localhost:3000

# 前端（另开窗口）
cd frontend
npm install
npm run dev                   # http://localhost:5173

# E2E（再开一窗，可选）
cd e2e
npm install
npx playwright install chromium chromium-headless-shell
npm test
```

## 自动化测试

| 层 | 跑法 | 数量 |
|---|---|---|
| 后端单测/集成（Jest + supertest） | `cd backend && npm test` | 77 |
| 端到端（Playwright + Chromium） | `cd e2e && npm test` | 20 |
| 端到端冒烟（supertest，仅 SQLite in-memory） | `cd backend && npm run smoke` | 23 步 |

## CI

GitHub Actions 配置在 [.github/workflows/ci.yml](.github/workflows/ci.yml)。

每次 push 到 main / master / develop 或开 PR 时，并行触发：

| Job | 内容 | 平均耗时 |
|---|---|---|
| `backend` | tsc + jest（SQLite in-memory） | ~2 min |
| `frontend` | tsc + vite build | ~2 min |
| `e2e` | 三方依赖装齐 + Chromium + Playwright（依赖前两者通过） | ~5 min |

E2E 失败时把 `playwright-report/` 和 `test-results/`（trace、video、screenshot）作为 artifact 上传，点开 run 页面就能下载回放。

Playwright 浏览器二进制走 `actions/cache`，键挂在 `e2e/package-lock.json` 哈希上——版本不变就直接命中。

## 文档

- [PRD文档.md](PRD文档.md) — 产品需求
- [TECH_DESIGN.md](TECH_DESIGN.md) — 技术架构
- [backend/README.md](backend/README.md) — 后端运行 / 迁移 / 边界约束
- [e2e/README.md](e2e/README.md) — E2E 跑法 / 调试技巧
