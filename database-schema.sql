-- ============================================
--  建IP — Supabase 数据库建表 SQL
--  在 Supabase → SQL Editor 中执行本文件
-- ============================================

-- 1. 用户资料表（扩展 auth.users）
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  avatar_url text,
  created_at timestamp with time zone default now()
);
alter table public.profiles enable row level security;
create policy "用户可查看自己的资料" on public.profiles for select using (auth.uid() = id);
create policy "用户可更新自己的资料" on public.profiles for update using (auth.uid() = id);

-- 2. 目标表
create table if not exists public.goals (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  why text,
  level text check (level in ('short','mid','long')),
  progress int default 0 check (progress >= 0 and progress <= 100),
  "archived" boolean default false,
  created_at timestamp with time zone default now()
);
alter table public.goals enable row level security;
create policy "用户可管理自己的目标" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. 日排表（每天一条）
create table if not exists public.dailies (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  day_str text not null,
  tasks jsonb default '{"morning":[],"afternoon":[],"evening":[]}'::jsonb,
  active_shichen int[] default '{}',
  created_at timestamp with time zone default now(),
  unique(user_id, day_str)
);
alter table public.dailies enable row level security;
create policy "用户可管理自己的日排表" on public.dailies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. 内容表
create table if not exists public.contents (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  type text,
  direction text,
  subtype text,
  status text check (status in ('想法','草稿','制作中','已发布')),
  date text,
  goal_id text,
  created_at timestamp with time zone default now()
);
alter table public.contents enable row level security;
create policy "用户可管理自己的内容" on public.contents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. 待定池表
create table if not exists public.pending_pool (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  priority text default '中' check (priority in ('高','中','低')),
  activated boolean default false,
  created_at timestamp with time zone default now()
);
alter table public.pending_pool enable row level security;
create policy "用户可管理自己的待定池" on public.pending_pool for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. 精力记录表
create table if not exists public.energy_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  day_str text not null,
  level int check (level >= 1 and level <= 5),
  note text,
  created_at timestamp with time zone default now()
);
alter table public.energy_logs enable row level security;
create policy "用户可管理自己的精力记录" on public.energy_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. 日志表
create table if not exists public.logs (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  date text not null,
  content text not null,
  created_at timestamp with time zone default now()
);
alter table public.logs enable row level security;
create policy "用户可管理自己的日志" on public.logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================
--  注册时自动创建 profiles 记录（触发器）
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
