# 问答社区数据库设计

## 用户表（users）

- id、username、email、password、avatar
- points: 积分
- created_at

## 问题表（questions）

- id、title、content（Markdown）
- tags: 标签（JSON 数组）
- author_id: 提问者 ID
- views: 浏览次数
- answers_count: 回答数
- votes: 点赞数
- is_solved: 是否已解决
- created_at、updated_at

## 回答表（answers）

- id、content（Markdown）
- question_id: 问题 ID
- author_id: 回答者 ID
- votes: 点赞数
- is_accepted: 是否被采纳
- created_at、updated_at

## 点赞表（votes）

- id、user_id、target_type（question/answer）
- target_id: 目标 ID
- created_at
