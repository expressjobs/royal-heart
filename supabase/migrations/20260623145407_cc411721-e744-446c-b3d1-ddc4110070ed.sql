-- Performance indexes for messaging
CREATE INDEX IF NOT EXISTS idx_messages_match_created
  ON public.messages (match_id, created_at DESC);

-- Speeds up unread-count and read-receipt lookups
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages (match_id, sender_id)
  WHERE read_at IS NULL;

-- Speeds up "my conversations" lookups on matches
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON public.matches (user1_id);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON public.matches (user2_id);