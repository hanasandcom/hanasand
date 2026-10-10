import run, { withTransaction } from '#db'

export default async function ensureRuleHitCountSchema() {
    await run(`CREATE TABLE IF NOT EXISTS rule_hit_counts (
        organization_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('findings', 'receipts')),
        rule_id TEXT NOT NULL,
        hits BIGINT NOT NULL DEFAULT 0 CHECK (hits >= 0),
        PRIMARY KEY (organization_id, source, rule_id)
    )`)
    await run(`CREATE TABLE IF NOT EXISTS rule_hit_count_state (
        id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
        initialized BOOLEAN NOT NULL DEFAULT FALSE
    )`)
    await run(`CREATE TABLE IF NOT EXISTS rule_hit_count_deltas (
        id BIGSERIAL PRIMARY KEY,
        organization_id TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('findings', 'receipts')),
        rule_id TEXT NOT NULL,
        delta BIGINT NOT NULL CHECK (delta <> 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await run('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rule_hit_count_deltas_lookup ON rule_hit_count_deltas(organization_id, source, rule_id)')
    await run('INSERT INTO rule_hit_count_state(id, initialized) VALUES(TRUE, FALSE) ON CONFLICT(id) DO NOTHING')
    await withTransaction(async query => {
        const state = await query('SELECT initialized FROM rule_hit_count_state WHERE id=TRUE FOR UPDATE')
        if (!state.rows[0]?.initialized) {
            await query('LOCK TABLE findings, log_analyze_receipts IN SHARE ROW EXCLUSIVE MODE')
            await query(`INSERT INTO rule_hit_counts(organization_id, source, rule_id, hits)
                SELECT organization_id, source, rule_id, count(*) FROM (
                    SELECT organization_id, 'findings'::text AS source, rule_id FROM findings
                    UNION ALL
                    SELECT organization_id, 'receipts'::text AS source, rule_id FROM log_analyze_receipts
                ) AS rule_hits GROUP BY organization_id, source, rule_id
                ON CONFLICT(organization_id, source, rule_id) DO UPDATE SET hits=EXCLUDED.hits`)
            await query('UPDATE rule_hit_count_state SET initialized=TRUE WHERE id=TRUE')
        }

        const installed = await query(`SELECT
            count(*) FILTER (WHERE tgname = ANY($1::text[])) AS installed_count,
            bool_or(tgname IN ('findings_rule_hit_count', 'log_analyze_receipts_rule_hit_count', 'log_analyze_receipts_write_lock')) AS legacy_installed
            FROM pg_trigger
            WHERE tgrelid IN ('findings'::regclass, 'log_analyze_receipts'::regclass) AND NOT tgisinternal`, [[
            'findings_rule_hit_count_insert', 'findings_rule_hit_count_delete', 'findings_rule_hit_count_update',
            'log_analyze_receipts_rule_hit_count_insert', 'log_analyze_receipts_rule_hit_count_delete', 'log_analyze_receipts_rule_hit_count_update',
        ]])
        if (Number(installed.rows[0]?.installed_count) === 6 && !installed.rows[0]?.legacy_installed) return

        await query(`CREATE OR REPLACE FUNCTION record_rule_hit_count_delta() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            hit_source TEXT := CASE WHEN TG_TABLE_NAME = 'findings' THEN 'findings' ELSE 'receipts' END;
        BEGIN
            IF TG_OP = 'INSERT' THEN
                INSERT INTO rule_hit_count_deltas(organization_id, source, rule_id, delta)
                SELECT organization_id, hit_source, rule_id, count(*)
                FROM new_rows GROUP BY organization_id, rule_id;
            ELSIF TG_OP = 'DELETE' THEN
                INSERT INTO rule_hit_count_deltas(organization_id, source, rule_id, delta)
                SELECT organization_id, hit_source, rule_id, -count(*)
                FROM old_rows GROUP BY organization_id, rule_id;
            ELSE
                INSERT INTO rule_hit_count_deltas(organization_id, source, rule_id, delta)
                SELECT organization_id, hit_source, rule_id, sum(delta)
                FROM (
                    SELECT organization_id, rule_id, -count(*) AS delta
                    FROM old_rows GROUP BY organization_id, rule_id
                    UNION ALL
                    SELECT organization_id, rule_id, count(*) AS delta
                    FROM new_rows GROUP BY organization_id, rule_id
                ) changes
                GROUP BY organization_id, rule_id HAVING sum(delta) <> 0;
            END IF;
            RETURN NULL;
        END
        $$`)

        await query('DROP TRIGGER IF EXISTS findings_rule_hit_count ON findings')
        await query('DROP TRIGGER IF EXISTS log_analyze_receipts_rule_hit_count ON log_analyze_receipts')
        await query('DROP TRIGGER IF EXISTS log_analyze_receipts_write_lock ON log_analyze_receipts')
        await query(`CREATE OR REPLACE TRIGGER findings_rule_hit_count_insert AFTER INSERT ON findings
            REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION record_rule_hit_count_delta()`)
        await query(`CREATE OR REPLACE TRIGGER findings_rule_hit_count_delete AFTER DELETE ON findings
            REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION record_rule_hit_count_delta()`)
        await query(`CREATE OR REPLACE TRIGGER findings_rule_hit_count_update AFTER UPDATE ON findings
            REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION record_rule_hit_count_delta()`)
        await query(`CREATE OR REPLACE TRIGGER log_analyze_receipts_rule_hit_count_insert AFTER INSERT ON log_analyze_receipts
            REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION record_rule_hit_count_delta()`)
        await query(`CREATE OR REPLACE TRIGGER log_analyze_receipts_rule_hit_count_delete AFTER DELETE ON log_analyze_receipts
            REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION record_rule_hit_count_delta()`)
        await query(`CREATE OR REPLACE TRIGGER log_analyze_receipts_rule_hit_count_update AFTER UPDATE ON log_analyze_receipts
            REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION record_rule_hit_count_delta()`)
        await query('DROP FUNCTION IF EXISTS maintain_rule_hit_count()')
        await query('DROP FUNCTION IF EXISTS serialize_log_analyze_receipt_writes()')
    })
}
