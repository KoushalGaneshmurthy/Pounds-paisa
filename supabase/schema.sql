-- Supabase Database Schema for Pounds & Paisa
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- 1. Create Profiles table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function and trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(LOWER(NEW.raw_user_meta_data->>'username'), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      username = COALESCE(EXCLUDED.username, public.profiles.username),
      updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to resolve username to email for seamless username login
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
  SELECT email FROM public.profiles WHERE LOWER(username) = LOWER(p_username) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Budget Configuration Table
CREATE TABLE IF NOT EXISTS public.budget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_label TEXT NOT NULL,
  monthly_allowance_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  savings_goal_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  groceries_cap_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  travel_cap_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  others_cap_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  university_cap_gbp NUMERIC(10, 2) NOT NULL DEFAULT 0,
  gbp_to_inr_rate NUMERIC(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT unique_user_month_config UNIQUE(user_id, month_label)
);

ALTER TABLE public.budget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own budget config"
  ON public.budget_configs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  merchant TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('groceries', 'travel', 'university', 'others')),
  sub_category TEXT,
  university_scope TEXT CHECK (university_scope IN ('monthly', 'separate') OR university_scope IS NULL),
  university_sub_category TEXT,
  amount_gbp NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  week SMALLINT NOT NULL CHECK (week BETWEEN 1 AND 4),
  date DATE NOT NULL,
  notes TEXT,
  rate_at_entry NUMERIC(10, 4),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own expenses"
  ON public.expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON public.expenses(user_id, category);

-- 4. Incomes / Salary Table
CREATE TABLE IF NOT EXISTS public.incomes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  amount_gbp NUMERIC(10, 2) NOT NULL,
  hours NUMERIC(6, 2),
  date DATE NOT NULL,
  rate_at_entry NUMERIC(10, 4),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Ensure hours column exists if table was created previously
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'incomes' AND column_name = 'hours'
  ) THEN
    ALTER TABLE public.incomes ADD COLUMN hours NUMERIC(6, 2);
  END IF;
END $$;

ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own incomes"
  ON public.incomes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON public.incomes(user_id, date DESC);

-- 5. Archived Months Table
CREATE TABLE IF NOT EXISTS public.archived_months (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_label TEXT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  config JSONB NOT NULL,
  expenses JSONB NOT NULL,
  incomes JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.archived_months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own archives"
  ON public.archived_months FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_archives_user ON public.archived_months(user_id, archived_at DESC);

-- 6. Custom Supermarkets Table
CREATE TABLE IF NOT EXISTS public.supermarkets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT unique_user_supermarket UNIQUE(user_id, name)
);

ALTER TABLE public.supermarkets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their custom supermarkets"
  ON public.supermarkets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
