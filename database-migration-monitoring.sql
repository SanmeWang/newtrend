-- 为 profiles 表添加 monitoring_items 字段（用户自定义监控检查项）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monitoring_items JSONB DEFAULT '[
    {"key":"overplanning","label":"今天我是不是又在改生活成长/加新想法？","desc":"多疑缺乏自信的表现：用规划逃避执行"},
    {"key":"escapism","label":"今天我是不是在用\"新东西\"覆盖焦虑？","desc":"用新鲜感代替脚踏实地"},
    {"key":"action","label":"今天我真的做了什么？还是只想不做？","desc":"己土日主：越不动越不想动"},
    {"key":"compare","label":"今天我是不是在和别人比较？","desc":"你的节奏是自己的，不是别人的"},
    {"key":"trust","label":"今天我能信任\"脚踏实地\"本身吗？","desc":"无为而治：专注的时候确实没有心思想别的"}
  ]';
