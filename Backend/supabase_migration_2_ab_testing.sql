-- ============================================================================
-- Aakarshan AI - migration 2: A/B testing of ad variants
-- Run AFTER supabase_migration.sql, once, in Supabase SQL Editor. Safe to re-run.
--
-- campaigns.variants     : JSON array of image URLs being A/B tested ([] = normal single-image ad)
-- ad_events.variant      : which variant (0,1,2...) the visitor was shown
-- record_ad_event(...)   : now takes p_variant and stores it with every event
-- ============================================================================

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ad_events ADD COLUMN IF NOT EXISTS variant smallint;
CREATE INDEX IF NOT EXISTS ad_events_variant_idx ON public.ad_events (campaign_id, variant, event_type);

-- replace the v1 function (different signature -> drop first)
DROP FUNCTION IF EXISTS public.record_ad_event(text, text, text, text, text, numeric);

CREATE OR REPLACE FUNCTION public.record_ad_event(
  p_campaign_id text,
  p_type        text,
  p_visitor     text,
  p_text        text     DEFAULT NULL,
  p_variant     smallint DEFAULT NULL
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

  -- variant only makes sense for A/B campaigns and must be in range
  IF jsonb_array_length(c.variants) = 0 THEN
    p_variant := NULL;
  ELSIF p_variant IS NULL OR p_variant < 0 OR p_variant >= jsonb_array_length(c.variants) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_variant');
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
    INSERT INTO public.ad_events (campaign_id, event_type, visitor_id, comment_text, variant)
    VALUES (c.id, p_type, p_visitor, CASE WHEN p_type = 'comment' THEN p_text END, p_variant);

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

  RETURN jsonb_build_object('ok', true, 'counted', counted, 'reason', reason,
    'views', c.views, 'likes', c.likes, 'shares', c.shares, 'comments', c.comments, 'clicks', c.clicks);
END;
$$;

REVOKE ALL ON FUNCTION public.record_ad_event(text,text,text,text,smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ad_event(text,text,text,text,smallint) TO service_role;
