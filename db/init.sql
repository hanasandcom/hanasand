-- Creates the database
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hanasand') THEN
        CREATE DATABASE hanasand;
    END IF;
END $$;

-- Enters the database
\c hanasand

-- Creates the user 'hanasand'
DO $$
DECLARE
    user_password text;
BEGIN
    user_password := current_setting('db_password', true);

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hanasand') THEN
        EXECUTE format('CREATE USER hanasand WITH ENCRYPTED PASSWORD %L', user_password);
        EXECUTE 'GRANT ALL PRIVILEGES ON DATABASE hanasand TO hanasand';
    END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS pgbouncer AUTHORIZATION hanasand;
REVOKE ALL ON SCHEMA pgbouncer FROM PUBLIC;
CREATE OR REPLACE FUNCTION pgbouncer.get_auth(p_username text)
RETURNS TABLE(username text, password text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog
AS $function$
    SELECT rolname::text, rolpassword::text
    FROM pg_catalog.pg_authid
    WHERE rolname = p_username AND rolcanlogin
$function$;
REVOKE ALL ON FUNCTION pgbouncer.get_auth(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA pgbouncer TO hanasand;
GRANT EXECUTE ON FUNCTION pgbouncer.get_auth(text) TO hanasand;

\ir init/00-identity.sql
\ir init/10-organizations.sql
\ir init/20-capacity-billing.sql
\ir init/40-public-api-keys.sql
\ir init/50-threat-intelligence.sql
\ir init/60-vm-runtime.sql
\ir init/70-service-monitoring.sql
\ir init/80-administration-audit.sql
\ir init/90-initial-accounts-and-roles.sql
\ir init/95-thesis.sql
\ir init/99-vm-access-and-billing.sql
