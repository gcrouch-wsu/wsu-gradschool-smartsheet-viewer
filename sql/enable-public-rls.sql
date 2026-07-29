-- Enable Row Level Security on all app-owned public tables.
--
-- This app uses direct server-side pg connections rather than Supabase PostgREST,
-- so these tables should not remain exposed without RLS.

ALTER TABLE IF EXISTS schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS config_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS config_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contributor_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contributor_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_workflow_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_field_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_conditional_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_webhook_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_approver_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_approver_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS form_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'admin_users'
        AND policyname = 'admin_users_app_role_access'
    ) THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO %I', 'admin_users_app_role_access', 'public', 'admin_users', current_user);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        'admin_users_app_role_access',
        'public',
        'admin_users',
        current_user
      );
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.config_sources') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'config_sources'
        AND policyname = 'config_sources_app_role_access'
    ) THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO %I', 'config_sources_app_role_access', 'public', 'config_sources', current_user);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        'config_sources_app_role_access',
        'public',
        'config_sources',
        current_user
      );
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.config_views') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'config_views'
        AND policyname = 'config_views_app_role_access'
    ) THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO %I', 'config_views_app_role_access', 'public', 'config_views', current_user);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        'config_views_app_role_access',
        'public',
        'config_views',
        current_user
      );
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.contributor_users') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'contributor_users'
        AND policyname = 'contributor_users_app_role_access'
    ) THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO %I', 'contributor_users_app_role_access', 'public', 'contributor_users', current_user);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        'contributor_users_app_role_access',
        'public',
        'contributor_users',
        current_user
      );
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.contributor_login_attempts') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'contributor_login_attempts'
        AND policyname = 'contributor_login_attempts_app_role_access'
    ) THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO %I', 'contributor_login_attempts_app_role_access', 'public', 'contributor_login_attempts', current_user);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        'contributor_login_attempts_app_role_access',
        'public',
        'contributor_login_attempts',
        current_user
      );
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.admin_login_attempts') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'admin_login_attempts'
        AND policyname = 'admin_login_attempts_app_role_access'
    ) THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO %I', 'admin_login_attempts_app_role_access', 'public', 'admin_login_attempts', current_user);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
        'admin_login_attempts_app_role_access',
        'public',
        'admin_login_attempts',
        current_user
      );
    END IF;
  END IF;
END
$$;
