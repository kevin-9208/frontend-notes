# 私人笔记应用 (Supabase + 原生 HTML/CSS/JS)

## 文件结构
```
notes-app/
├── index.html     # 页面结构
├── style.css      # 样式
├── config.js      # Supabase 连接配置（需要修改）
├── app.js         # 应用逻辑
└── schema.sql     # 数据库建表 + RLS 策略
```

## 部署步骤

### 1. 创建 Supabase 项目
前往 https://supabase.com 创建一个新项目。

### 2. 执行 SQL
打开 Supabase 控制台 -> **SQL Editor**，粘贴并运行 `schema.sql` 中的全部内容。
这会创建：
- `categories` 表（笔记分类）
- `notes` 表（笔记本体，含富文本内容、收藏、分类、时间戳）
- 自动更新 `updated_at` 的触发器
- 启用 RLS，并添加策略确保用户只能访问自己的数据

### 3. 配置认证
在 Supabase 控制台 -> **Authentication -> Providers**，确保 **Email** 登录已启用。
如果你不想要邮箱验证流程（方便本地测试），可以在 **Authentication -> Settings** 中关闭
"Confirm email"。

### 4. 填写前端配置
打开 `config.js`，替换为你的项目信息（在 **Project Settings -> API** 中获取）：
```js
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

### 5. 运行
直接用浏览器打开 `index.html`，或使用任意静态服务器：
```bash
npx serve .
```
（直接双击打开 `file://` 在某些浏览器下也可正常工作，但推荐使用 http 服务器。）

## 功能说明

| 功能 | 说明 |
|---|---|
| 注册 / 登录 / 退出 | Supabase Auth（邮箱+密码） |
| 富文本笔记 | `contenteditable` + `execCommand`，支持粗体/斜体/下划线/删除线/列表/标题 |
| 分类管理 | 创建、删除分类；删除分类后笔记自动变为"未分类"（`ON DELETE SET NULL`） |
| 编辑/删除笔记 | 完整 CRUD |
| 自动保存 | 输入后 800ms 防抖自动保存到数据库 |
| 搜索 | 按标题和正文内容（去除 HTML 标签后）实时搜索 |
| 收藏 | 一键收藏/取消收藏，支持按收藏筛选 |
| 最近编辑排序 | 笔记列表始终按 `updated_at` 倒序排列 |

## 安全说明
所有数据访问均通过 Supabase RLS 策略限制为 `auth.uid() = user_id`，
确保每个用户只能读写自己的笔记和分类，前端无需额外的权限判断。

## 可扩展方向
- 使用 Supabase Storage 上传图片插入笔记
- 使用 Supabase Realtime 订阅 `notes` 表变化，实现多端实时同步
- 使用 `to_tsvector` 全文索引做服务端全文搜索（schema 中已预留索引）
- 标签（多对多）系统替代/补充单一分类
