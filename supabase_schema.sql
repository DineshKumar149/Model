-- ============================================================
-- ATOME - COMPLETE UNIFIED DATABASE SCHEMA & POLICIES
-- ============================================================
-- This file defines the complete database schema for Atome.
-- paste and run this code inside the Supabase SQL Editor.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1. BASE TABLES: PROFILES & POSTS
-- ─────────────────────────────────────────────────────────

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  image_url TEXT,
  caption TEXT,
  likes_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Post Likes Table
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Post Comments Table
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- 2. MESSAGES, CONVERSATIONS & TYPING
-- ─────────────────────────────────────────────────────────

-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'dm', -- 'dm' or 'group'
  name TEXT,
  avatar_url TEXT,
  wallpaper_url TEXT,
  is_request BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation Participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type = ANY (ARRAY['text','image','video','voice','audio','gif','sticker','shared_post'])),
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  call_duration INTEGER DEFAULT 0,
  view_limit INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  viewer_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Message Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Message Reads
CREATE TABLE IF NOT EXISTS public.message_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Typing Indicators
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- ─────────────────────────────────────────────────────────
-- 3. CALLING, NOTIFICATIONS & BLOCKING SYSTEMS
-- ─────────────────────────────────────────────────────────

-- Calls Logs Table
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  call_type TEXT NOT NULL DEFAULT 'audio', -- 'audio' or 'video'
  status TEXT NOT NULL DEFAULT 'missed', -- 'missed', 'answered', 'rejected', 'ended'
  started_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  missed_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Blocks Table
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'like', 'comment', 'share', 'save', 'view_feed', 'message', 'call'
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Anyone can view profiles." ON public.profiles;
CREATE POLICY "Anyone can view profiles." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Posts Policies
DROP POLICY IF EXISTS "Anyone can view posts." ON public.posts;
CREATE POLICY "Anyone can view posts." ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own posts." ON public.posts;
CREATE POLICY "Users can insert their own posts." ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts." ON public.posts;
CREATE POLICY "Users can delete their own posts." ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Likes Policies
DROP POLICY IF EXISTS "Anyone can view likes." ON public.post_likes;
CREATE POLICY "Anyone can view likes." ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can toggle likes." ON public.post_likes;
CREATE POLICY "Authenticated users can toggle likes." ON public.post_likes FOR ALL USING (auth.uid() = user_id);

-- Comments Policies
DROP POLICY IF EXISTS "Anyone can view comments." ON public.post_comments;
CREATE POLICY "Anyone can view comments." ON public.post_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage comment actions." ON public.post_comments;
CREATE POLICY "Authenticated users can manage comment actions." ON public.post_comments FOR ALL USING (auth.uid() = user_id);

-- Conversations Policies
DROP POLICY IF EXISTS "Participants can view conversations." ON public.conversations;
CREATE POLICY "Participants can view conversations." ON public.conversations FOR SELECT
  USING (id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Participants can update conversations." ON public.conversations;
CREATE POLICY "Participants can update conversations." ON public.conversations FOR UPDATE
  USING (id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

-- Conversation Participants Policies
DROP POLICY IF EXISTS "Users can view participants." ON public.conversation_participants;
CREATE POLICY "Users can view participants." ON public.conversation_participants FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Participants can insert new members." ON public.conversation_participants;
CREATE POLICY "Participants can insert new members." ON public.conversation_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can remove participants." ON public.conversation_participants;
CREATE POLICY "Users can remove participants." ON public.conversation_participants FOR DELETE USING (auth.uid() = user_id OR auth.role() = 'authenticated');

-- Messages Policies
DROP POLICY IF EXISTS "Participants can view messages." ON public.messages;
CREATE POLICY "Participants can view messages." ON public.messages FOR SELECT
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Participants can send messages." ON public.messages;
CREATE POLICY "Participants can send messages." ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own messages." ON public.messages;
CREATE POLICY "Users can delete their own messages." ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- Calls Policies
DROP POLICY IF EXISTS "Users can read calls." ON public.calls;
CREATE POLICY "Users can read calls." ON public.calls FOR SELECT USING (caller_id = auth.uid() OR callee_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert calls." ON public.calls;
CREATE POLICY "Users can insert calls." ON public.calls FOR INSERT WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "Users can update calls." ON public.calls;
CREATE POLICY "Users can update calls." ON public.calls FOR UPDATE USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- Blocks Policies
DROP POLICY IF EXISTS "Users can view block status." ON public.user_blocks;
CREATE POLICY "Users can view block status." ON public.user_blocks FOR SELECT USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage blocks." ON public.user_blocks;
CREATE POLICY "Users can manage blocks." ON public.user_blocks FOR ALL USING (blocker_id = auth.uid());

-- Notifications Policies
DROP POLICY IF EXISTS "Users can view notifications." ON public.notifications;
CREATE POLICY "Users can view notifications." ON public.notifications FOR SELECT USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert notifications." ON public.notifications;
CREATE POLICY "Users can insert notifications." ON public.notifications FOR INSERT WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update notifications." ON public.notifications;
CREATE POLICY "Users can update notifications." ON public.notifications FOR UPDATE USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete notifications." ON public.notifications;
CREATE POLICY "Users can delete notifications." ON public.notifications FOR DELETE USING (recipient_id = auth.uid());

-- ─────────────────────────────────────────────────────────
-- 5. STORAGE BUCKETS & POLICIES
-- ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Avatar/Post Images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar/Post Images are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'post-images');

DROP POLICY IF EXISTS "Users can upload their own post-images." ON storage.objects;
CREATE POLICY "Users can upload their own post-images." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own post-images." ON storage.objects;
CREATE POLICY "Users can update their own post-images." ON storage.objects FOR UPDATE USING (bucket_id = 'post-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their own post-images." ON storage.objects;
CREATE POLICY "Users can delete their own post-images." ON storage.objects FOR DELETE USING (bucket_id = 'post-images' AND auth.role() = 'authenticated');

-- Chat Media Storage Policies
DROP POLICY IF EXISTS "Chat media is publicly accessible." ON storage.objects;
CREATE POLICY "Chat media is publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Users can upload chat media." ON storage.objects;
CREATE POLICY "Users can upload chat media." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their chat media." ON storage.objects;
CREATE POLICY "Users can delete their chat media." ON storage.objects FOR DELETE USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Call Recordings Storage Policies
DROP POLICY IF EXISTS "Call recordings are publicly accessible." ON storage.objects;
CREATE POLICY "Call recordings are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'call-recordings');

DROP POLICY IF EXISTS "Users can upload call recordings." ON storage.objects;
CREATE POLICY "Users can upload call recordings." ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'call-recordings' AND auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────
-- 6. DB FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────────────────

-- Auto sync profile on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
        avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Default group room
INSERT INTO public.conversations (id, type, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'group', 'Alpha Squad')
ON CONFLICT (id) DO NOTHING;

-- Auto-add new users to the default group
CREATE OR REPLACE FUNCTION public.add_user_to_default_group()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES ('00000000-0000-0000-0000-000000000001', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_join_default_group ON auth.users;
CREATE TRIGGER on_auth_user_join_default_group
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.add_user_to_default_group();

-- Direct Message creation utility helper function
CREATE OR REPLACE FUNCTION public.get_or_create_dm(_other_user UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _conv_id UUID;
BEGIN
  SELECT cp1.conversation_id INTO _conv_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN public.conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = _other_user
    AND c.type = 'dm'
  LIMIT 1;

  IF _conv_id IS NOT NULL THEN
    RETURN _conv_id;
  END IF;

  INSERT INTO public.conversations (type) VALUES ('dm') RETURNING id INTO _conv_id;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (_conv_id, auth.uid());
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (_conv_id, _other_user);

  RETURN _conv_id;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- 7. REAL-TIME PUBLICATION INCLUSIONS
-- ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_reads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'typing_indicators') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'calls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_blocks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_blocks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
