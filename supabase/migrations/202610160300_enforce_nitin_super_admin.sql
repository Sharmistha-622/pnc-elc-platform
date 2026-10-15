-- Migration: 202610160300_enforce_nitin_super_admin.sql
-- Enforce nitin@navgurukul.org as an immutable Super Admin across the database and auth system.

-- 1. Database-level RLS role check override
CREATE OR REPLACE FUNCTION public.current_app_role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select case
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'nitin@navgurukul.org' then 'Super Admin'
    else coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'Employee')
  end;
$$;

-- 2. Update auth.users record if it already exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'Super Admin')
    WHERE lower(email) = 'nitin@navgurukul.org';
  END IF;
END $$;

-- 3. Database trigger to guarantee role = 'Super Admin' on insert/update for nitin@navgurukul.org
CREATE OR REPLACE FUNCTION public.enforce_nitin_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF lower(coalesce(NEW.email, '')) = 'nitin@navgurukul.org' THEN
    NEW.raw_app_meta_data = coalesce(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'Super Admin');
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS trg_enforce_nitin_super_admin ON auth.users;
    CREATE TRIGGER trg_enforce_nitin_super_admin
    BEFORE INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_nitin_super_admin();
  END IF;
END $$;
