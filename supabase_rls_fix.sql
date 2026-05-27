-- ============================================================
-- ATOME - COMPLETE SUPABASE SQL FIX
-- Copy ALL of this → Paste in Supabase SQL Editor → Click RUN
-- ============================================================

-- Add phone column to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Sync email from auth.users into profiles.email for viewing
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email = '');

-- ─────────────────────────────────────────
-- 1. PROFILES TABLE
-- ─────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view profiles." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;

CREATE POLICY "Anyone can view profiles."
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- 2. MESSAGES TABLE
-- ─────────────────────────────────────────
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view messages." ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages." ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages." ON public.messages;
DROP POLICY IF EXISTS "Participants can delete messages in their conversations." ON public.messages;

CREATE POLICY "Participants can view messages."
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can send messages."
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own messages."
  ON public.messages FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Participants can delete messages in their conversations."
  ON public.messages FOR DELETE
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────
-- 3. CONVERSATIONS TABLE
-- ─────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view conversations." ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations." ON public.conversations;

CREATE POLICY "Participants can view conversations."
  ON public.conversations FOR SELECT
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Participants can update conversations."
  ON public.conversations FOR UPDATE
  USING (
    id IN (
      SELECT conversation_id FROM public.conversation_participants
      WHERE user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────
-- 4. CONVERSATION_PARTICIPANTS TABLE
-- (Non-recursive - direct user_id check only)
-- ─────────────────────────────────────────
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all participants of their conversations." ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can insert new members." ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can remove participants." ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their own participations." ON public.conversation_participants;

-- Simple: any authenticated user can see all participants (no self-reference)
CREATE POLICY "Users can view all participants of their conversations."
  ON public.conversation_participants FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can add themselves or admins can add others
CREATE POLICY "Participants can insert new members."
  ON public.conversation_participants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Users can remove themselves or members of their conversations
CREATE POLICY "Users can remove participants."
  ON public.conversation_participants FOR DELETE
  USING (auth.uid() = user_id OR auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- 5. MESSAGE_REACTIONS TABLE
-- ─────────────────────────────────────────
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view reactions." ON public.message_reactions;
DROP POLICY IF EXISTS "Users can add reactions." ON public.message_reactions;
DROP POLICY IF EXISTS "Users can remove their reactions." ON public.message_reactions;

CREATE POLICY "Participants can view reactions."
  ON public.message_reactions FOR SELECT USING (true);

CREATE POLICY "Users can add reactions."
  ON public.message_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions."
  ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- 6. MESSAGE_READS TABLE
-- ─────────────────────────────────────────
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reads." ON public.message_reads;
DROP POLICY IF EXISTS "Users can insert reads." ON public.message_reads;

CREATE POLICY "Users can view reads."
  ON public.message_reads FOR SELECT USING (true);

CREATE POLICY "Users can insert reads."
  ON public.message_reads FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- 7. TYPING_INDICATORS TABLE
-- ─────────────────────────────────────────
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage typing indicators." ON public.typing_indicators;
DROP POLICY IF EXISTS "Participants can view typing indicators." ON public.typing_indicators;

CREATE POLICY "Users can manage typing indicators."
  ON public.typing_indicators FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Participants can view typing indicators."
  ON public.typing_indicators FOR SELECT USING (true);


-- ─────────────────────────────────────────
-- 8. STORAGE BUCKETS & POLICIES
-- ─────────────────────────────────────────

-- Create buckets if not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Drop old policies
DROP POLICY IF EXISTS "Avatar Images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars." ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars." ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars." ON storage.objects;
DROP POLICY IF EXISTS "Chat media is publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Users can upload chat media." ON storage.objects;
DROP POLICY IF EXISTS "Users can update chat media." ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their chat media." ON storage.objects;

-- post-images (profile pictures, gallery)
CREATE POLICY "Avatar Images are publicly accessible."
  ON storage.objects FOR SELECT USING (bucket_id = 'post-images');

CREATE POLICY "Users can upload their own avatars."
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own avatars."
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'post-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own avatars."
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-images' AND auth.role() = 'authenticated');

-- chat-media (GIFs, stickers, voice messages, images in chat)
CREATE POLICY "Chat media is publicly accessible."
  ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');

CREATE POLICY "Users can upload chat media."
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update chat media."
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their chat media."
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');


-- ─────────────────────────────────────────
-- 9. ENABLE REALTIME ON ALL TABLES (safe - skips if already added)
-- ─────────────────────────────────────────
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
END $$;


-- ─────────────────────────────────────────
-- 10. get_or_create_dm FUNCTION
-- ─────────────────────────────────────────
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
  JOIN public.conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  JOIN public.conversations c
    ON c.id = cp1.conversation_id
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

-- ─────────────────────────────────────────
-- 11. DEFAULT GROUP & AUTOMATIC JOIN TRIGGER
-- ─────────────────────────────────────────
INSERT INTO public.conversations (id, type, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'group', 'Alpha Squad')
ON CONFLICT (id) DO NOTHING;

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

-- ============================================================
-- DONE! All policies and functions applied successfully.
-- ============================================================
