-- Persist each agent reply against the user message it answers and prevent clients from
-- inserting, changing, or deleting assistant messages. Apply before deploying the chat route.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID
  REFERENCES public.messages(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_one_reply_per_user
  ON public.messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

DROP POLICY IF EXISTS "owner_messages" ON public.messages;
DROP POLICY IF EXISTS "owner_messages_read" ON public.messages;
DROP POLICY IF EXISTS "owner_messages_add_own_words" ON public.messages;

CREATE POLICY "owner_messages_read" ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = messages.case_id
        AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY "owner_messages_add_own_words" ON public.messages
  FOR INSERT
  WITH CHECK (
    role = 'user'
    AND reply_to_message_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.cases
      WHERE cases.id = messages.case_id
        AND cases.user_id = auth.uid()
    )
  );
