-- 新流：自定义三级分类体系 · 数据库迁移
-- 在 Supabase SQL Editor 中执行

-- 1. 创建 categories 表（用户自定义三级分类）
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,           -- 分类名称
  level INT NOT NULL DEFAULT 1, -- 层级：1=大分类, 2=方向, 3=细分
  parent_id UUID,               -- 父分类 ID（level 2/3 必填）
  sort_order INT DEFAULT 0,     -- 排序
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE
);

-- 2. RLS：用户只能访问自己的分类
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own categories" ON public.categories;
CREATE POLICY "Users can manage own categories" ON public.categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. 给 dailies 表的 tasks JSONB 中的任务增加 category_id 字段
--    注意：tasks 是 JSONB 字段，字段由应用层控制，这里不需要改表结构
--    但为了方便查询，给 contents 表加 category_id 列

ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS category_path TEXT;  -- "一级 > 二级 > 三级" 冗余存储方便显示

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_contents_category ON public.contents(category_id);
