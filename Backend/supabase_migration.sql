-- ============================================================================
-- Aakarshan AI — engagement tracking migration
-- Run ONCE in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- Why: the old /simulate endpoint faked likes/shares/comments with Math.random()
-- and counted every click as a view. This replaces it with a real event log and
-- one atomic, de-duplicated function that updates the counters.
-- ============================================================================

-- 1. New counter / scoring columns on campaigns -------------------------------
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS clicks                 integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS performance_confidence text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS scored_at              timestamptz;

ALTER TABLE public.campaigns ALTER COLUMN views    SET DEFAULT 0;
ALTER TABLE public.campaigns ALTER COLUMN likes    SET DEFAULT 0;
ALTER TABLE public.campaigns ALTER COLUMN shares   SET DEFAULT 0;
ALTER TABLE public.campaigns ALTER COLUMN comments SET DEFAULT 0;
UPDATE public.campaigns SET views    = 0 WHERE views    IS NULL;
UPDATE public.campaigns SET likes    = 0 WHERE likes    IS NULL;
UPDATE public.campaigns SET shares   = 0 WHERE shares   IS NULL;
UPDATE public.campaigns SET comments = 0 WHERE comments IS NULL;
UPDATE public.campaigns SET clicks   = 0 WHERE clicks   IS NULL;

-- 2. Event log (source of truth) ----------------------------------------------
-- campaign_id gets the same type as campaigns.id (uuid or bigint), whichever you used.
DO $$
DECLARE id_type text;
BEGIN
  SELECT format_type(atttypid, atttypmod) INTO id_type
  FROM pg_attribute
  WHERE attrelid = 'public.campaigns'::regclass AND attname = 'id';

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.ad_events (
      id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      campaign_id     %s NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
      event_type      text NOT NULL CHECK (event_type IN ('view','like','share','comment','click')),
      visitor_id      text NOT NULL,
      comment_text    text,
      sentiment       text,
      sentiment_score numeric,
      created_at      timestamptz NOT NULL DEFAULT now()
    )$f$, id_type);
END $$;

CREATE INDEX IF NOT EXISTS ad_events_campaign_time_idx ON public.ad_events (campaign_id, created_at);
CREATE INDEX IF NOT EXISTS ad_events_dedupe_idx        ON public.ad_events (campaign_id, visitor_id, event_type, created_at);

-- Only the backend (service role) touches this table; block direct browser access.
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

-- 3. Atomic, de-duplicated recording ------------------------------------------
-- Rules (per visitor, per campaign):
--   view    counted once per 30 minutes        (refreshing does not inflate views)
--   like    counted once, ever
--   share   counted once, ever
--   click   counted once per 10 minutes        (CTA button)
--   comment counted, max 5 per hour, 1–500 chars
-- The campaign row is locked (FOR UPDATE) so concurrent visitors can never
-- overwrite each other's counts.
CREATE OR REPLACE FUNCTION public.record_ad_event(
  p_campaign_id     text,
  p_type            text,
  p_visitor         text,
  p_text            text    DEFAULT NULL,
  p_sentiment       text    DEFAULT NULL,
  p_sentiment_score numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        public.campaigns%ROWTYPE;
  counted  boolean := false;
  reason   text    := NULL;
BEGIN
  IF p_type NOT IN ('view','like','share','comment','click') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_event_type');
  END IF;
  IF p_visitor IS NULL OR length(p_visitor) < 8 OR length(p_visitor) > 64 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_visitor');
  END IF;

  SELECT * INTO c FROM public.campaigns WHERE id::text = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF p_type = 'view' THEN
    counted := NOT EXISTS (SELECT 1 FROM public.ad_events
      WHERE campaign_id = c.id AND visitor_id = p_visitor AND event_type = 'view'
        AND created_at > now() - interval '30 minutes');
  ELSIF p_type = 'like' THEN
    counted := NOT EXISTS (SELECT 1 FROM public.ad_events
      WHERE campaign_id = c.id AND visitor_id = p_visitor AND event_type = 'like');
  ELSIF p_type = 'share' THEN
    counted := NOT EXISTS (SELECT 1 FROM public.ad_events
      WHERE campaign_id = c.id AND visitor_id = p_visitor AND event_type = 'share');
  ELSIF p_type = 'click' THEN
    counted := NOT EXISTS (SELECT 1 FROM public.ad_events
      WHERE campaign_id = c.id AND visitor_id = p_visitor AND event_type = 'click'
        AND created_at > now() - interval '10 minutes');
  ELSIF p_type = 'comment' THEN
    p_text := btrim(coalesce(p_text, ''));
    IF length(p_text) < 1 OR length(p_text) > 500 THEN
      counted := false; reason := 'bad_comment_length';
    ELSE
      counted := (SELECT count(*) FROM public.ad_events
        WHERE campaign_id = c.id AND visitor_id = p_visitor AND event_type = 'comment'
          AND created_at > now() - interval '1 hour') < 5;
      IF NOT counted THEN reason := 'rate_limited'; END IF;
    END IF;
  END IF;

  IF counted THEN
    INSERT INTO public.ad_events (campaign_id, event_type, visitor_id, comment_text, sentiment, sentiment_score)
    VALUES (c.id, p_type, p_visitor,
            CASE WHEN p_type = 'comment' THEN p_text END,
            CASE WHEN p_type = 'comment' THEN p_sentiment END,
            CASE WHEN p_type = 'comment' THEN p_sentiment_score END);

    UPDATE public.campaigns SET
      views    = coalesce(views,    0) + (p_type = 'view')::int,
      likes    = coalesce(likes,    0) + (p_type = 'like')::int,
      shares   = coalesce(shares,   0) + (p_type = 'share')::int,
      comments = coalesce(comments, 0) + (p_type = 'comment')::int,
      clicks   = coalesce(clicks,   0) + (p_type = 'click')::int
    WHERE id = c.id
    RETURNING * INTO c;
  ELSIF reason IS NULL THEN
    reason := 'duplicate';
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'counted', counted, 'reason', reason,
    'views', c.views, 'likes', c.likes, 'shares', c.shares,
    'comments', c.comments, 'clicks', c.clicks
  );
END;
$$;

-- Only the backend's service-role key may call it (not anonymous browsers).
REVOKE ALL ON FUNCTION public.record_ad_event(text,text,text,text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ad_event(text,text,text,text,text,numeric) TO service_role;

-- 4. OPTIONAL: wipe the fake counters left over from the old /simulate endpoint.
--    Uncomment and run once if you want every existing campaign to start clean.
-- UPDATE public.campaigns SET views=0, likes=0, shares=0, comments=0, clicks=0,
--        performance_score=NULL, performance_tier=NULL, performance_confidence=NULL;
