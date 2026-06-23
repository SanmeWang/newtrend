# 建IP — Supabase 云版 配置说明

## 第一步：创建 Supabase 项目

1. 打开 https://supabase.com → 注册 / 登录
2. 点「New Project」
3. 填写：
   - Project name：`jian-ip`
   - Database Password：记下来（后面不需要填，但建议记）
   - Region：选 `Northeast Asia (Seoul)` 或 `Singapore`（离中国近）
4. 等待项目创建（约 1 分钟）

## 第二步：建数据表

1. 在 Supabase 后台 → 左侧点「SQL Editor」
2. 点「New Query」
3. 打开本目录下的 `database-schema.sql`，全选复制
4. 粘贴到 SQL Editor，点「Run」
5. 看到「Success」即完成

## 第三步：获取 API 密钥

1. 在 Supabase 后台 → 左侧点「Project Settings」
2. 点「API」
3. 复制这两个值：
   - `URL` → 填入 `app-supabase.js` 第 6 行 `SUPABASE_URL`
   - `anon/public` key → 填入 `app-supabase.js` 第 7 行 `SUPABASE_ANON_KEY`

## 第四步：开启邮箱注册

1. 在 Supabase 后台 → 左侧点「Authentication」
2. 点「Providers」→「Email」
3. 确认「Enable Email Signup」是开启状态
4. （可选）关闭「Confirm email」— 开发阶段可以跳过邮件确认

## 第五步：运行

直接用浏览器打开 `index.html` 即可（Supabase JS 通过 CDN 加载，不需要服务器）。

---

## 和本地版的区别

| 功能 | 本地多用户 | Supabase 云版 |
|------|------------|--------------|
| 数据存储 | localStorage（本机） | Supabase 云端 Postgres |
| 多设备同步 | ❌ | ✅ |
| 用户系统 | 虚拟档案（无密码） | 真实账号密码 |
| 注册登录 | ❌ | ✅（邮箱+密码） |
| 数据备份 | 手动导出 | 自动（云端） |
| 成本 | 免费 | 免费版够用（500 用户） |
| 上架 App | 困难 | 容易（有后端） |

## 推荐

- **自己用** → 本地多用户版（简单，零成本）
- **给别人用 / 多设备** → Supabase 云版
- **想以后上架应用商店** → Supabase 云版（有真实用户系统）
