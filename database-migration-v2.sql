-- ============================================
--  建IP — Supabase 云版迁移 SQL（完整版）
--  在 Supabase SQL Editor 中一次性执行
-- ============================================

-- 0. 先清理所有旧 RLS 策略（让数据能自由读写）
drop policy if exists "用户可管理自己的目标" on public.goals;
drop policy if exists "用户可管理自己的日排表" on public.dailies;
drop policy if exists "用户可管理自己的内容" on public.contents;
drop policy if exists "用户可管理自己的待定池" on public.pending_pool;
drop policy if exists "用户可管理自己的精力记录" on public.energy_logs;
drop policy if exists "用户可管理自己的日志" on public.logs;
drop policy if exists "用户可查看自己的资料" on public.profiles;
drop policy if exists "用户可更新自己的资料" on public.profiles;

-- 1. 修改 user_id 为 text 类型（不再依赖 auth.users）
alter table public.goals alter column user_id type text;
alter table public.dailies alter column user_id type text;
alter table public.contents alter column user_id type text;
alter table public.pending_pool alter column user_id type text;
alter table public.energy_logs alter column user_id type text;
alter table public.logs alter column user_id type text;

-- 2. 重建 dailies 唯一约束（user_id 类型变了需要重建）
alter table public.dailies drop constraint if exists dailies_user_id_day_str_key;
alter table public.dailies add constraint dailies_user_id_day_str_key unique(user_id, day_str);

-- 3. goals 表补字段
alter table public.goals add column if not exists priority text default 'mid';
alter table public.goals add column if not exists parent_id text;
alter table public.goals add column if not exists updated_at timestamp with time zone default now();

-- 4. dailies 表补字段（改用本地版的 flat 结构）
alter table public.dailies add column if not exists reflection text default '';
alter table public.dailies add column if not exists notes text default '';
alter table public.dailies add column if not exists energy int default 0;
alter table public.dailies add column if not exists monitoring jsonb default '{}'::jsonb;

-- 5. contents 表补字段
alter table public.contents add column if not exists platform text default '';
alter table public.contents add column if not exists note text default '';
alter table public.contents add column if not exists sub_direction text default '';
alter table public.contents add column if not exists updated_at timestamp with time zone default now();

-- 6. 重建 RLS 策略 — 允许所有操作（无登录，固定用户 ID）
create policy "allow_all_goals" on public.goals for all using (true) with check (true);
create policy "allow_all_dailies" on public.dailies for all using (true) with check (true);
create policy "allow_all_contents" on public.contents for all using (true) with check (true);
create policy "allow_all_pending" on public.pending_pool for all using (true) with check (true);
create policy "allow_all_energy" on public.energy_logs for all using (true) with check (true);
create policy "allow_all_logs" on public.logs for all using (true) with check (true);
