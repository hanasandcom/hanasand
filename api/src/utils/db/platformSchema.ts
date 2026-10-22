import run from '#db'
import { ensureFailoverSchema } from '../vms/failover.ts'
import { ensureContainerBillingSchema } from '../../handlers/containerBilling.ts'
import ensureServiceAccountsSchema from './serviceAccountsSchema.ts'
import ensureAccountIdentitySchema from './accountIdentitySchema.ts'
import ensureThesisSchema from './thesisSchema.ts'

export default async function ensurePlatformSchema() {
    await run(`CREATE SCHEMA IF NOT EXISTS pgbouncer AUTHORIZATION hanasand;
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
            GRANT EXECUTE ON FUNCTION pgbouncer.get_auth(text) TO hanasand`)
    await run('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vm_metrics_name_created ON vm_metrics(name, created_at DESC)')
    await run('DROP TABLE IF EXISTS root')
    await ensureContainerBillingSchema()
    await ensureFailoverSchema()
    await ensureAccountIdentitySchema()
    await ensureServiceAccountsSchema()
    await ensureThesisSchema()
}
