# 问答社区技术架构文档

## 1. 技术栈选择

### 1.1 前端技术
- **框架**：React 18
- **语言**：TypeScript 5.x
- **构建工具**：Vite 5.x
- **状态管理**：Redux Toolkit
- **路由**：React Router v6
- **UI组件库**：Ant Design 5.x
- **样式**：CSS Modules + SCSS
- **HTTP客户端**：Axios
- **表单处理**：React Hook Form
- **验证**：Zod

### 1.2 后端技术
- **语言**：Node.js 18+
- **框架**：Express 4.x
- **ORM**：Sequelize
- **认证**：JWT (jsonwebtoken)
- **密码加密**：bcryptjs
- **CORS**：cors
- **日志**：winston
- **环境变量**：dotenv

### 1.3 数据库
- **类型**：MySQL 8.0+
- **连接池**：mysql2

## 2. 项目结构

### 2.1 前端项目结构
```
frontend/
├── public/              # 静态资源
├── src/
│   ├── components/      # 通用组件
│   ├── pages/           # 页面组件
│   ├── hooks/           # 自定义Hooks
│   ├── store/           # Redux状态管理
│   ├── services/        # API服务
│   ├── utils/           # 工具函数
│   ├── types/           # TypeScript类型定义
│   ├── styles/          # 全局样式
│   ├── App.tsx          # 应用根组件
│   ├── main.tsx         # 应用入口
│   └── routes.tsx       # 路由配置
├── tsconfig.json        # TypeScript配置
├── vite.config.ts       # Vite配置
└── package.json         # 依赖配置
```

### 2.2 后端项目结构
```
backend/
├── src/
│   ├── controllers/     # 控制器
│   ├── models/          # 数据模型
│   ├── routes/          # 路由
│   ├── middleware/      # 中间件
│   ├── services/        # 业务逻辑
│   ├── utils/           # 工具函数
│   ├── config/          # 配置文件
│   └── app.ts           # 应用入口
├── .env                 # 环境变量
├── tsconfig.json        # TypeScript配置（可选）
└── package.json         # 依赖配置
```

## 3. 数据模型

### 3.1 用户表 (users)
| 字段名 | 数据类型 | 约束 | 描述 |
|-------|---------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 用户ID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | 用户名 |
| email | VARCHAR(100) | UNIQUE, NOT NULL | 邮箱 |
| password | VARCHAR(100) | NOT NULL | 密码哈希 |
| avatar | VARCHAR(255) | DEFAULT NULL | 头像URL |
| points | INT | DEFAULT 0 | 积分 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

### 3.2 问题表 (questions)
| 字段名 | 数据类型 | 约束 | 描述 |
|-------|---------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 问题ID |
| title | VARCHAR(200) | NOT NULL | 标题 |
| content | TEXT | NOT NULL | 内容 |
| user_id | INT | FOREIGN KEY (users.id) | 提问用户ID |
| view_count | INT | DEFAULT 0 | 浏览次数 |
| like_count | INT | DEFAULT 0 | 点赞数 |
| answer_count | INT | DEFAULT 0 | 回答数 |
| status | ENUM('open', 'closed') | DEFAULT 'open' | 状态 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

### 3.3 回答表 (answers)
| 字段名 | 数据类型 | 约束 | 描述 |
|-------|---------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 回答ID |
| content | TEXT | NOT NULL | 内容 |
| question_id | INT | FOREIGN KEY (questions.id) | 问题ID |
| user_id | INT | FOREIGN KEY (users.id) | 回答用户ID |
| like_count | INT | DEFAULT 0 | 点赞数 |
| is_accepted | BOOLEAN | DEFAULT FALSE | 是否被采纳 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

### 3.4 标签表 (tags)
| 字段名 | 数据类型 | 约束 | 描述 |
|-------|---------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 标签ID |
| name | VARCHAR(50) | UNIQUE, NOT NULL | 标签名称 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 3.5 问题标签关联表 (question_tags)
| 字段名 | 数据类型 | 约束 | 描述 |
|-------|---------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 关联ID |
| question_id | INT | FOREIGN KEY (questions.id) | 问题ID |
| tag_id | INT | FOREIGN KEY (tags.id) | 标签ID |

### 3.6 点赞表 (likes)
| 字段名 | 数据类型 | 约束 | 描述 |
|-------|---------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 点赞ID |
| user_id | INT | FOREIGN KEY (users.id) | 用户ID |
| target_id | INT | NOT NULL | 目标ID（问题或回答） |
| target_type | ENUM('question', 'answer') | NOT NULL | 目标类型 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### 3.7 积分记录表 (point_records)
| 字段名 | 数据类型 | 约束 | 描述 |
|-------|---------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 记录ID |
| user_id | INT | FOREIGN KEY (users.id) | 用户ID |
| type | ENUM('ask', 'answer', 'accept') | NOT NULL | 积分类型 |
| points | INT | NOT NULL | 积分数量 |
| related_id | INT | DEFAULT NULL | 相关ID（问题或回答） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

## 4. 关键技术点

### 4.1 前端技术点

#### 4.1.1 状态管理
- 使用Redux Toolkit管理全局状态，包括用户信息、问题列表、回答列表等
- 采用RTK Query处理API请求，简化数据获取逻辑

#### 4.1.2 路由管理
- 使用React Router v6实现页面路由
- 实现私有路由，确保未登录用户无法访问需要认证的页面

#### 4.1.3 性能优化
- 使用React.memo、useMemo、useCallback优化组件渲染
- 实现虚拟列表，提高长列表的渲染性能
- 图片懒加载，减少初始加载时间

#### 4.1.4 表单处理
- 使用React Hook Form处理表单，提高表单性能
- 结合Zod进行表单验证，确保数据合法性

### 4.2 后端技术点

#### 4.2.1 认证与授权
- 实现JWT认证机制，确保API安全
- 中间件验证用户身份，保护需要认证的路由

#### 4.2.2 数据查询优化
- 使用Sequelize ORM进行数据库操作
- 实现查询缓存，减少数据库压力
- 合理使用索引，提高查询性能

#### 4.2.3 并发控制
- 实现点赞、采纳等操作的并发控制，避免数据不一致
- 使用事务确保数据操作的原子性

#### 4.2.4 错误处理
- 统一的错误处理机制，确保API返回一致的错误格式
- 详细的日志记录，便于问题排查

### 4.3 数据库技术点

#### 4.3.1 索引设计
- 为频繁查询的字段创建索引，如问题的标题、创建时间等
- 为外键字段创建索引，提高关联查询性能

#### 4.3.2 数据关系
- 合理设计表之间的关系，确保数据完整性
- 使用级联操作，简化数据管理

### 4.4 部署与运维

#### 4.4.1 环境配置
- 使用环境变量管理不同环境的配置
- 实现CI/CD流程，自动化部署

#### 4.4.2 监控与日志
- 集成监控工具，实时监控系统状态
- 完善的日志记录，便于问题排查

## 5. 技术实现路径

### 5.1 开发阶段
1. **环境搭建**：初始化前端和后端项目，配置开发环境
2. **数据库设计**：创建数据库表结构，建立数据模型
3. **后端API开发**：实现用户、问题、回答等核心API
4. **前端页面开发**：实现首页、问题详情页、发布问题页等
5. **功能测试**：测试核心功能，确保正常运行

### 5.2 优化阶段
1. **性能优化**：优化前端渲染性能和后端响应速度
2. **安全加固**：加强认证授权，防止安全漏洞
3. **用户体验优化**：改进界面设计，提高用户体验

### 5.3 部署阶段
1. **构建打包**：前端项目构建，后端代码编译
2. **部署上线**：部署到生产环境，配置服务器
3. **监控维护**：设置监控，定期维护系统

---

本技术架构文档基于项目需求和技术栈选择编写，为开发团队提供了明确的技术实现指导。