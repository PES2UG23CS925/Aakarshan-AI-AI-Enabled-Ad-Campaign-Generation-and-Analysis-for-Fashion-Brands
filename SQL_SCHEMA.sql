-- ============================================
-- AKARSHAN AI - Supabase Database Schema
-- ============================================
-- This file contains all SQL queries needed to set up
-- the Supabase database for the AKARSHAN AI application

-- ============================================
-- 1. USERS TABLE
-- ============================================
-- Stores user profile information
-- Links to Supabase auth.users table via id

CREATE TABLE IF NOT EXISTS public.users (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  industry TEXT,
  company_name TEXT,
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- ============================================
-- 2. CAMPAIGNS TABLE
-- ============================================
-- Stores AI-generated advertising campaigns
-- Each campaign is linked to a user

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  category TEXT NOT NULL, -- e.g., 'Fashion', 'Tech', 'Food'
  target_audience TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'Instagram', 'Facebook', 'TikTok', 'LinkedIn'
  prompt TEXT, -- User's custom prompt/brief
  headline TEXT NOT NULL,
  ad_copy TEXT NOT NULL,
  cta TEXT NOT NULL, -- Call-to-Action: 'Shop Now', 'Learn More', etc.
  image_url TEXT,
  status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'
  performance_score DECIMAL(5,2),
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  ctr DECIMAL(5,2), -- Click-Through Rate
  engagement_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON public.campaigns(platform);

-- ============================================
-- 3. CAMPAIGN_METRICS TABLE
-- ============================================
-- Tracks daily metrics for each campaign
-- Used for analytics and performance tracking

CREATE TABLE IF NOT EXISTS public.campaign_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_campaign_id ON public.campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON public.campaign_metrics(date);

-- ============================================
-- 4. TEMPLATES TABLE
-- ============================================
-- Reusable campaign templates for faster generation

CREATE TABLE IF NOT EXISTS public.templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  platform TEXT NOT NULL,
  headline_template TEXT,
  copy_template TEXT,
  cta_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_public BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);

-- ============================================
-- 5. AI_GENERATIONS TABLE
-- ============================================
-- Logs all AI generation requests for analytics

CREATE TABLE IF NOT EXISTS public.ai_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  model_used TEXT DEFAULT 'gpt-4', -- Model version used for generation
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  status TEXT DEFAULT 'success', -- 'success', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_generations_user_id ON public.ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON public.ai_generations(created_at);

-- ============================================
-- 6. USER_SESSIONS TABLE
-- ============================================
-- Track user login sessions for security

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.user_sessions(token);

-- ============================================
-- 7. AUDIT_LOG TABLE
-- ============================================
-- Track all important actions for compliance

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_log(created_at);

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

-- Users table - Users can only view their own profile and admin can view all
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Campaigns table - Users can view and manage their own campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns
  FOR SELECT
  USING (auth.uid() = user_id OR status = 'published');

CREATE POLICY "Users can create their own campaigns"
  ON public.campaigns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns
  FOR DELETE
  USING (auth.uid() = user_id);

-- Campaign metrics table - Users can view metrics for their campaigns
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics for their campaigns"
  ON public.campaign_metrics
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = campaign_id AND user_id = auth.uid()
  ));

-- Templates table - Users can view their templates and public templates
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own and public templates"
  ON public.templates
  FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "Users can manage their own templates"
  ON public.templates
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- AI Generations table - Users can view their own generations
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generations"
  ON public.ai_generations
  FOR SELECT
  USING (user_id = auth.uid());

-- Sessions table - Users can view their own sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- Audit log table - Only admins can view
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
  ON public.audit_log
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- CREATE FUNCTIONS FOR AUTOMATION
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate campaign metrics
CREATE OR REPLACE FUNCTION calculate_campaign_ctr()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.impressions > 0 THEN
    NEW.ctr = (NEW.clicks::DECIMAL / NEW.impressions) * 100;
  END IF;
  
  IF NEW.clicks + NEW.conversions > 0 THEN
    NEW.engagement_rate = ((NEW.clicks + NEW.conversions)::DECIMAL / NEW.impressions) * 100;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_metrics_calc
BEFORE INSERT OR UPDATE ON public.campaign_metrics
FOR EACH ROW
EXECUTE FUNCTION calculate_campaign_ctr();

-- ============================================
-- SAMPLE DATA (OPTIONAL)
-- ============================================
-- Uncomment and run if you want to seed the database with sample data

-- INSERT INTO public.templates (name, category, platform, headline_template, copy_template, cta_template, is_public)
-- VALUES
-- ('Tech Startup - Instagram', 'Tech', 'Instagram', 'Revolutionary {{product}}', 'Discover the future of {{category}}', 'Learn More', true),
-- ('Fashion - TikTok', 'Fashion', 'TikTok', 'Trendy {{brand}} Collection', 'Be part of the {{season}} trend', 'Shop Now', true),
-- ('Food - Facebook', 'Food', 'Facebook', 'Delicious {{product}} Awaits You', '{{brand}} brings quality to your table', 'Order Now', true);

-- ============================================
-- DATABASE VIEWS FOR ANALYTICS
-- ============================================

-- Create view for campaign summary
CREATE OR REPLACE VIEW public.campaign_summary AS
SELECT
  c.id,
  c.user_id,
  u.full_name,
  u.email,
  c.brand_name,
  c.platform,
  c.status,
  COUNT(DISTINCT cm.date) as days_active,
  COALESCE(SUM(cm.views), 0) as total_views,
  COALESCE(SUM(cm.clicks), 0) as total_clicks,
  COALESCE(SUM(cm.conversions), 0) as total_conversions,
  COALESCE(SUM(cm.cost), 0) as total_cost,
  COALESCE(SUM(cm.revenue), 0) as total_revenue,
  c.created_at,
  c.updated_at
FROM public.campaigns c
LEFT JOIN public.users u ON c.user_id = u.id
LEFT JOIN public.campaign_metrics cm ON c.id = cm.campaign_id
GROUP BY c.id, u.id;

-- Create view for user statistics
CREATE OR REPLACE VIEW public.user_statistics AS
SELECT
  u.id,
  u.email,
  u.full_name,
  COUNT(DISTINCT c.id) as total_campaigns,
  COUNT(DISTINCT CASE WHEN c.status = 'published' THEN c.id END) as published_campaigns,
  COALESCE(SUM(cm.views), 0) as total_views,
  COALESCE(SUM(cm.clicks), 0) as total_clicks,
  COALESCE(AVG(cm.views), 0) as avg_views_per_day,
  u.created_at
FROM public.users u
LEFT JOIN public.campaigns c ON u.id = c.user_id
LEFT JOIN public.campaign_metrics cm ON c.id = cm.campaign_id
GROUP BY u.id;
