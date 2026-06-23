-- Fix: active_shichen column type INT[] -> TEXT[]
-- JS stores string keys like "zi","chou", not integers
ALTER TABLE public.dailies ALTER COLUMN active_shichen TYPE TEXT[] USING active_shichen::TEXT[];
