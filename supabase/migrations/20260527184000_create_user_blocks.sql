CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own blocks." 
ON public.user_blocks 
FOR ALL 
USING (blocker_id = auth.uid());

CREATE POLICY "Users can view blocks concerning themselves." 
ON public.user_blocks 
FOR SELECT 
USING (blocker_id = auth.uid() OR blocked_id = auth.uid());
