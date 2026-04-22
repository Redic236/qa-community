# E2E — Playwright

对整个问答社区跑端到端浏览器测试：**真实 Chromium + 真实前后端 + 真实 HTTP**。

## 运行

```bash
cd e2e
npm install
npx playwright install chromium    # 首次使用下载浏览器
npm test                           # 串行跑所有 spec
npm run test:headed                # 带浏览器窗口看回放
npm run test:ui                    # 交互式 UI 模式调试
npm run report                     # 看 HTML 报告
```

## webServer 行为

`playwright.config.ts` 里配置：

- 若 `localhost:3000` / `localhost:5173` 已有服务在跑 → **复用**
- 否则自动启：后端走 `NODE_ENV=test`（SQLite in-memory，干净起步），前端 `npm run dev`

所以你想怎么跑都行：自己开着 dev server、或让 Playwright 全自动。

## 测试数据隔离

因为可能复用你本地的 MySQL dev server，测试不能假设 DB 为空。
- **每个测试创建唯一用户**：`makeUser()` 用 `randomBytes(4)` 生成独立用户名/邮箱
- **断言都是自洽的**：验证本次创建的数据可见/积分正确、不检查全局计数
- 测试间相互独立，可按任意顺序跑

## 覆盖的关键流程

| Spec | 用例 |
|---|---|
| `auth.spec.ts` | 注册、登录、退出、错密码、Zod 中文错误、重复邮箱 |
| `questions.spec.ts` | 创建、编辑(Modal)、删除(Popconfirm)、非作者看不到编辑/删除 |
| `answers-voting.spec.ts` | 发答案、点赞问题、自赞 disabled、采纳、取消采纳 |
| `profile.spec.ts` | 个人中心、积分流水、改用户名、改密码（成功+失败） |

## 失败时的产物

- `test-results/` — 每个失败用例的 trace、screenshot、video
- `playwright-report/index.html` — 可视化报告（跑完打开 `npm run report`）
