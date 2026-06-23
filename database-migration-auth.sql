-- ============================================
--  建IP — 云版迁移 SQL：加回 Supabase Auth
--  在 Supabase SQL Editor 中一次性执行
--  注意：这会清空现有数据（旧数据使用假用户ID，无法匹配真实用户）
-- ============================================

-- 0. 清空现有数据
DELETE FROM public.dailies;
DELETE FROM public.energy_logs;
DELETE FROM public.logs;
DELETE FROM public.contents;
DELETE FROM public.pending_pool;
DELETE FROM public.goals;

-- 1. 删除 allow_all 策略
DROP POLICY IF EXISTS "allow_all_goals" ON public.goals;
DROP POLICY IF EXISTS "allow_all_dailies" ON public.dailies;
DROP POLICY IF EXISTS "allow_all_contents" ON public.contents;
DROP POLICY IF EXISTS "allow_all_pending" ON public.pending_pool;
DROP POLICY IF EXISTS "allow_all_energy" ON public.energy_logs;
DROP POLICY IF EXISTS "allow_all_logs" ON public.logs;

-- 删除旧的 auth RLS 策略（如果还存在）
DROP POLICY IF EXISTS "用户可管理自己的目标" ON public.goals;
DROP POLICY IF EXISTS "用户可管理自己的日排表" ON public.dailies;
DROP POLICY IF EXISTS "用户可管理自己的内容" ON public.contents;
DROP POLICY IF EXISTS "用户可管理自己的待定池" ON public.pending_pool;
DROP POLICY IF EXISTS "用户可管理自己的精力记录" ON public.energy_logs;
DROP POLICY IF EXISTS "用户可管理自己的日志" ON public.logs;
DROP POLICY IF EXISTS "用户可查看自己的资料" ON public.profiles;
DROP POLICY IF EXISTS "用户可更新自己的资料" ON public.profiles;

-- 2. 修改 user_id 从 text 改回 uuid（先删约束再改类型）
ALTER TABLE public.dailies DROP CONSTRAINT IF EXISTS dailies_user_id_day_str_key;

ALTER TABLE public.goals ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.dailies ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.contents ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.pending_pool ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.energy_logs ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.logs ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- 3. 重建外键约束（关联 auth.users）
ALTER TABLE public.goals ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.dailies ADD CONSTRAINT dailies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.contents ADD CONSTRAINT contents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.pending_pool ADD CONSTRAINT pending_pool_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.energy_logs ADD CONSTRAINT energy_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.logs ADD CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. 重建 dailies 唯一约束
ALTER TABLE public.dailies ADD CONSTRAINT dailies_user_id_day_str_key UNIQUE(user_id, day_str);

-- 5. 重建 RLS 策略（使用真实 auth.uid()）
CREATE POLICY "用户可管理自己的目标" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的日排表" ON public.dailies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的内容" ON public.contents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的待定池" ON public.pending_pool FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的精力记录" ON public.energy_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的日志" ON public.logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可查看自己的资料" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "用户可更新自己的资料" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. 重新启用 RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dailies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
