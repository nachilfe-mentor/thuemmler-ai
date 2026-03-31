-- ============================================
-- Shift07.ai Database Schema
-- ============================================

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'pro', 'cancelled')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_period_end TIMESTAMPTZ,
  analyses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analyses
CREATE TABLE IF NOT EXISTS public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  anonymous_ip_hash TEXT,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  overall_score INTEGER,
  category_scores JSONB DEFAULT '{}',
  issues JSONB DEFAULT '[]',
  raw_metadata JSONB DEFAULT '{}',
  page_title TEXT,
  summary TEXT,
  quick_wins JSONB DEFAULT '[]',
  is_free_analysis BOOLEAN DEFAULT false,
  ai_model_used TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issue status tracking (checklist)
CREATE TABLE IF NOT EXISTS public.issue_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  issue_key TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  UNIQUE(analysis_id, issue_key)
);

-- Tracked URLs for monitoring
CREATE TABLE IF NOT EXISTS public.tracked_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  schedule TEXT DEFAULT 'weekly' CHECK (schedule IN ('daily', 'weekly', 'monthly')),
  last_analysis_id UUID REFERENCES public.analyses(id),
  next_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate limiting for anonymous users
CREATE TABLE IF NOT EXISTS public.rate_limits (
  ip_hash TEXT PRIMARY KEY,
  last_analysis_at TIMESTAMPTZ DEFAULT NOW(),
  analysis_count INTEGER DEFAULT 1
);

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracked_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/update their own
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Analyses: users see own, anon can see their own by ip hash
CREATE POLICY "Users read own analyses" ON public.analyses FOR SELECT USING (
  auth.uid() = user_id OR user_id IS NULL
);
CREATE POLICY "Authenticated users insert analyses" ON public.analyses FOR INSERT WITH CHECK (
  auth.uid() = user_id OR user_id IS NULL
);

-- Issue status: users manage their own
CREATE POLICY "Users manage own issue status" ON public.issue_status FOR ALL USING (auth.uid() = user_id);

-- Tracked URLs: users manage their own
CREATE POLICY "Users manage own tracked urls" ON public.tracked_urls FOR ALL USING (auth.uid() = user_id);

-- Rate limits: allow insert/update from anon (for free scans)
CREATE POLICY "Anyone can read rate limits" ON public.rate_limits FOR SELECT USING (true);
CREATE POLICY "Anyone can insert rate limits" ON public.rate_limits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rate limits" ON public.rate_limits FOR UPDATE USING (true);

-- ============================================
-- Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON public.analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON public.analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_url ON public.analyses(url);
CREATE INDEX IF NOT EXISTS idx_tracked_urls_user_id ON public.tracked_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_urls_next_run ON public.tracked_urls(next_run_at) WHERE is_active = true;
