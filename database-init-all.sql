-- ============================================
--  新流 — Supabase 全量建表 SQL（从零开始）
--  在 Supabase SQL Editor 中一次性执行
-- ============================================

-- ============================================
--  1. 用户资料表（扩展 auth.users）
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  avatar_url TEXT,
  monitoring_items JSONB DEFAULT '[
    {"key":"overplanning","label":"今天我是不是又在改生活成长/加新想法？","desc":"多疑缺乏自信的表现：用规划逃避执行"},
    {"key":"escapism","label":"今天我是不是在用\"新东西\"覆盖焦虑？","desc":"用新鲜感代替脚踏实地"},
    {"key":"action","label":"今天我真的做了什么？还是只想不做？","desc":"己土日主：越不动越不想动"},
    {"key":"compare","label":"今天我是不是在和别人比较？","desc":"你的节奏是自己的，不是别人的"},
    {"key":"trust","label":"今天我能信任\"脚踏实地\"本身吗？","desc":"无为而治：专注的时候确实没有心思想别的"}
  ]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
--  2. 目标表
-- ============================================
CREATE TABLE IF NOT EXISTS public.goals (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  why TEXT,
  level TEXT CHECK (level IN ('short','mid','long')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  priority TEXT DEFAULT 'mid',
  parent_id TEXT,
  "archived" BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- ============================================
--  3. 日排表（每天一条）
-- ============================================
CREATE TABLE IF NOT EXISTS public.dailies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  day_str TEXT NOT NULL,
  tasks JSONB DEFAULT '{"morning":[],"afternoon":[],"evening":[]}'::jsonb,
  active_shichen TEXT[] DEFAULT '{}',
  reflection TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  energy INT DEFAULT 0,
  monitoring JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day_str)
);
ALTER TABLE public.dailies ENABLE ROW LEVEL SECURITY;

-- ============================================
--  4. 内容表
-- ============================================
CREATE TABLE IF NOT EXISTS public.contents (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  type TEXT,
  direction TEXT,
  subtype TEXT,
  platform TEXT DEFAULT '',
  note TEXT DEFAULT '',
  sub_direction TEXT DEFAULT '',
  category_id UUID,
  category_path TEXT,
  status TEXT CHECK (status IN ('想法','草稿','制作中','已发布')),
  date TEXT,
  goal_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

-- ============================================
--  5. 待定池表
-- ============================================
CREATE TABLE IF NOT EXISTS public.pending_pool (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT '中' CHECK (priority IN ('高','中','低')),
  activated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.pending_pool ENABLE ROW LEVEL SECURITY;

-- ============================================
--  6. 精力记录表
-- ============================================
CREATE TABLE IF NOT EXISTS public.energy_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  day_str TEXT NOT NULL,
  level INT CHECK (level >= 1 AND level <= 5),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.energy_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
--  7. 日志表
-- ============================================
CREATE TABLE IF NOT EXISTS public.logs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- ============================================
--  8. 自定义三级分类表
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 3),
  parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============================================
--  9. 用户反馈表
-- ============================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'suggestion',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- ============================================
--  10. RLS 策略（auth.uid() 隔离）
--  每次执行先删后建，确保可重复执行
-- ============================================
DROP POLICY IF EXISTS "用户可查看自己的资料" ON public.profiles;
DROP POLICY IF EXISTS "用户可更新自己的资料" ON public.profiles;
DROP POLICY IF EXISTS "用户可管理自己的目标" ON public.goals;
DROP POLICY IF EXISTS "用户可管理自己的日排表" ON public.dailies;
DROP POLICY IF EXISTS "用户可管理自己的内容" ON public.contents;
DROP POLICY IF EXISTS "用户可管理自己的待定池" ON public.pending_pool;
DROP POLICY IF EXISTS "用户可管理自己的精力记录" ON public.energy_logs;
DROP POLICY IF EXISTS "用户可管理自己的日志" ON public.logs;
DROP POLICY IF EXISTS "用户可管理自己的分类" ON public.categories;
DROP POLICY IF EXISTS "Users can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;

CREATE POLICY "用户可查看自己的资料" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "用户可更新自己的资料" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "用户可管理自己的目标" ON public.goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的日排表" ON public.dailies FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的内容" ON public.contents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的待定池" ON public.pending_pool FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的精力记录" ON public.energy_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的日志" ON public.logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "用户可管理自己的分类" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own feedback" ON public.feedback FOR SELECT USING (auth.uid() = user_id);

-- ============================================
--  11. 注册时自动创建 profiles 触发器
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
