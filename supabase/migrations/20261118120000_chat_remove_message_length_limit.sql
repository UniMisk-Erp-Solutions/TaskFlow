-- Chat messages no longer stop at 4,000 characters. The app now folds long messages behind "Show more" / "Show less".
-- Postgres text has no practical limit; this only keeps an absurdly large paste from being stored.
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_content_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_content_check CHECK (
  char_length(body) <= 200000 AND (char_length(btrim(body)) > 0 OR attachment_path IS NOT NULL)
);
