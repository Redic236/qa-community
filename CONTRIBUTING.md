# 贡献指南

## 分支模型

```
main    ── 稳定可部署，保护分支；只接受从 develop 或 release/* 合并进来
develop ── 日常集成分支，CI 通过的 PR 合到这里
feature/* ── 单个功能开发分支，从 develop 开出，合回 develop
fix/*     ── bug 修复，同 feature/*
release/x.y ── 发版冻结分支（可选，tag 前的最后一轮集成）
hotfix/*  ── 线上紧急修复，从 main 开出，合回 main + develop
```

日常工作流：

```bash
git checkout develop && git pull
git checkout -b feature/xxx
# ... code, commit ...
git push -u origin feature/xxx        # 第一次推
# 开 PR → develop，CI 过了再 merge
```

## 提交消息（Conventional Commits）

```
<type>(<scope>): <subject>

<body>
```

| type | 含义 |
|---|---|
| `feat` | 新功能 |
| `fix` | bug 修复 |
| `refactor` | 既不加功能也不修 bug 的代码改动 |
| `perf` | 性能优化 |
| `docs` | 仅文档 |
| `test` | 加/改测试，不改产品代码 |
| `chore` | 构建、依赖、配置、CI 等非代码改动 |
| `ci` | 仅 CI 配置 |

`<scope>` 建议用包名或领域：`backend`, `frontend`, `e2e`, `ops`, `admin`, `i18n`, `sse`...

**subject 一行内说清"做了什么"，正文（可选）说"为什么"。**

good:
```
feat(backend): add ETag + Cache-Control on list endpoints

Express already emits weak ETag for res.json; we add
Cache-Control: private, must-revalidate + Vary: Authorization
so the browser actually participates. Per-user `liked` field
is viewer-specific — Vary keeps cache entries isolated.
```

bad:
```
update
fix bug
changes
```

## Pre-commit 自查

推前至少本地跑过：

```bash
# 后端
cd backend && npx tsc --noEmit && npx jest --silent

# 前端
cd frontend && npx tsc --noEmit && npm run build

# E2E（改了任何 UI 流程必须跑）
cd e2e && npx playwright test
```

CI 同样会跑，但本地失败就别推。

## PR 规范

- 标题：`<type>(<scope>): <短描述>`
- 正文包含：
  - **What**：改了什么（一两段 / bullet）
  - **Why**：为什么要改
  - **How to test**：reviewer 怎么验证
- 截图 / 录屏：UI 改动必须贴
- 链接：关联 issue 或 PRD 章节

## 敏感数据

- `.env` / `*.env` 永远不上库（已在 `.gitignore`）
- 真实密码 / API key / JWT secret 只走 `.env` 或 GitHub Secrets
- 提交前 `git diff --cached` 扫一遍别漏

## 大块改动

> 200 行以上的单个 PR 建议拆成多个原子 commit，便于 `git bisect` 定位 regression。
