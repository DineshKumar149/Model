-- ============================================================
-- MIGRATION: Add posts feature columns
-- hide_likes, turn_off_commenting, alt_text, music_title,
-- image_urls (carousel support), media_type
-- Also ensures posts UPDATE policy exists for post editing
-- ============================================================

-- Add missing columns to posts table (all safe with IF NOT EXISTS)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS image_urls        TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS media_type        TEXT   DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS hide_likes        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS turn_off_commenting BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alt_text          TEXT,
  ADD COLUMN IF NOT EXISTS music_title       TEXT;

-- Ensure profiles table has needed columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username    TEXT,
  ADD COLUMN IF NOT EXISTS bio         TEXT,
  ADD COLUMN IF NOT EXISTS website     TEXT,
  ADD COLUMN IF NOT EXISTS websites    TEXT[],
  ADD COLUMN IF NOT EXISTS cover_url   TEXT,
  ADD COLUMN IF NOT EXISTS is_private  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Ensure user_follows table exists for follow system
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'following',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view follows." ON public.user_follows;
CREATE POLICY "Users can view follows." ON public.user_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own follows." ON public.user_follows;
CREATE POLICY "Users can manage own follows." ON public.user_follows FOR ALL USING (follower_id = auth.uid());

-- Stories table (if not exists)
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  caption TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view stories." ON public.stories;
CREATE POLICY "Anyone can view stories." ON public.stories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own stories." ON public.stories;
CREATE POLICY "Users can insert own stories." ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own stories." ON public.stories;
CREATE POLICY "Users can delete own stories." ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Ensure posts UPDATE policy exists (for CE.SDK edits from profile grid)
DROP POLICY IF EXISTS "Users can update their own posts." ON public.posts;
CREATE POLICY "Users can update their own posts." ON public.posts FOR UPDATE USING (auth.uid() = user_id);

-- Add post_id to notifications (for like/comment linking)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE;

-- Add notification delete policy for senders
DROP POLICY IF EXISTS "Senders can delete notifications." ON public.notifications;
CREATE POLICY "Senders can delete notifications." ON public.notifications FOR DELETE USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Realtime for posts and stories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'post_likes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'post_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'stories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_follows') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_follows;
  END IF;
END $$;

ALTER TABLE public.posts REPLICA IDENTITY FULL;
