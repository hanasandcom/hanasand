import run, { markIdentityDataDetached, queryOnce, withTransaction } from '#db'
import { identityDataPrimaryKeys, identityDataTables } from './identityDataTables.ts'

export async function identityDataBoundaryReady() {
    if (!identityDatabaseEnabled()) return false
    const result = await queryOnce(`
        SELECT (to_regclass('public.identity_data_boundary') IS NOT NULL) AND EXISTS (
                SELECT 1 FROM pg_class
                WHERE oid = to_regclass('public.users') AND relkind = 'v'
           ) AS ready
    `)
    return result.rows[0]?.ready === true
}

export async function ensureIdentityDataBoundary() {
    if (!identityDatabaseEnabled() || process.env.DEPLOYMENT_CANDIDATE_ONLY === '1') return false
    if (await identityDataBoundaryReady()) {
        markIdentityDataDetached()
        return false
    }

    const dbUser = process.env.DB_USER || 'hanasand'
    const password = process.env.DB_PASSWORD
    // postgres_fdw sets remote session state; a transaction pooler can leak
    // that state to unrelated clients, so keep this bounded connection direct.
    const fdwHost = process.env.HANASAND_IDENTITY_FDW_HOST || 'identity-postgres'
    const fdwPort = Number(process.env.HANASAND_IDENTITY_FDW_PORT || 5432)
    const fdwDatabase = process.env.IDENTITY_DB_NAME || 'identity'
    if (!password) throw new Error('DB_PASSWORD is required to connect Hanasand API PostgreSQL to Identity PostgreSQL.')

    await run('CREATE EXTENSION IF NOT EXISTS postgres_fdw')
    await run('CREATE SCHEMA IF NOT EXISTS identity_data_remote')
    await run(`
        DO $identity_server$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'identity_data_server') THEN
                EXECUTE ${quoteLiteral(`CREATE SERVER identity_data_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host ${quoteLiteral(fdwHost)}, port ${quoteLiteral(String(fdwPort))}, dbname ${quoteLiteral(fdwDatabase)})`)};
            END IF;
        END
        $identity_server$
    `)
    const mapping = await queryOnce(`
        SELECT 1 FROM pg_user_mappings
        WHERE srvname = 'identity_data_server' AND usename = $1
    `, [dbUser])
    if (!mapping.rowCount) {
        await run(`CREATE USER MAPPING FOR ${quoteIdentifier(dbUser)} SERVER identity_data_server OPTIONS (user ${quoteLiteral(dbUser)}, password ${quoteLiteral(password)})`)
    } else {
        await run(`ALTER USER MAPPING FOR ${quoteIdentifier(dbUser)} SERVER identity_data_server OPTIONS (SET user ${quoteLiteral(dbUser)}, SET password ${quoteLiteral(password)})`)
    }

    const imported = await queryOnce('SELECT to_regclass(\'identity_data_remote.users\') AS relation')
    if (!imported.rows[0]?.relation) {
        await run(`IMPORT FOREIGN SCHEMA public LIMIT TO (${identityDataTables.join(', ')}) FROM SERVER identity_data_server INTO identity_data_remote`)
    }

    await withTransaction(async query => {
        const relations = await query(`
            SELECT c.relname, c.relkind
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
        `, [[...identityDataTables]])
        if (relations.rows.some(row => row.relkind === 'v')) {
            throw new Error('Identity data boundary is partially installed; refusing to overwrite a mixed schema.')
        }

        const localTables = relations.rows.filter(row => row.relkind === 'r' || row.relkind === 'p').map(row => row.relname as string)
        if (!localTables.includes('users') || !localTables.includes('organizations')) {
            throw new Error('The API database is missing users or organizations; refusing to discard the legacy identity data.')
        }
        await query(`LOCK TABLE ${localTables.map(name => `public.${quoteIdentifier(name)}`).join(', ')} IN ACCESS EXCLUSIVE MODE`)

        const counts: Record<string, { api: number; identity: number }> = {}
        for (const name of identityDataTables) {
            const localCount = localTables.includes(name)
                ? Number((await query(`SELECT count(*)::text AS count FROM public.${quoteIdentifier(name)}`)).rows[0].count)
                : 0
            const remoteCount = Number((await query(`SELECT count(*)::text AS count FROM identity_data_remote.${quoteIdentifier(name)}`)).rows[0].count)
            if (localCount !== remoteCount) {
                throw new Error(`Identity migration verification failed for ${name}: API has ${localCount} rows and Identity has ${remoteCount}.`)
            }
            counts[name] = { api: localCount, identity: remoteCount }
        }

        await query(`
            CREATE TABLE identity_data_local_foreign_keys (
                constraint_name TEXT NOT NULL,
                child_schema TEXT NOT NULL,
                child_table TEXT NOT NULL,
                parent_table TEXT NOT NULL,
                child_columns TEXT[] NOT NULL,
                parent_columns TEXT[] NOT NULL,
                delete_action CHAR(1) NOT NULL,
                match_type CHAR(1) NOT NULL
            )
        `)
        await query(`
            CREATE TABLE identity_data_boundary_keys (
                table_name TEXT PRIMARY KEY,
                key_columns TEXT[] NOT NULL
            )
        `)
        for (const [tableName, keyColumns] of Object.entries(identityDataPrimaryKeys)) {
            await query('INSERT INTO identity_data_boundary_keys (table_name, key_columns) VALUES ($1, $2)', [tableName, [...keyColumns]])
        }

        const droppedConstraints = await query(`
            SELECT n.nspname AS schema_name, child.relname AS table_name, con.conname,
                   parent.relname AS parent_table, con.confdeltype AS delete_action,
                   con.confmatchtype AS match_type,
                   array_agg(child_column.attname ORDER BY fk_columns.ordinality)::text[] AS child_columns,
                   array_agg(parent_column.attname ORDER BY fk_columns.ordinality)::text[] AS parent_columns
            FROM pg_constraint con
            JOIN pg_class child ON child.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = child.relnamespace
            JOIN pg_class parent ON parent.oid = con.confrelid
            JOIN pg_namespace pn ON pn.oid = parent.relnamespace
            CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY
                AS fk_columns(child_attnum, parent_attnum, ordinality)
            JOIN pg_attribute child_column ON child_column.attrelid = child.oid AND child_column.attnum = fk_columns.child_attnum
            JOIN pg_attribute parent_column ON parent_column.attrelid = parent.oid AND parent_column.attnum = fk_columns.parent_attnum
            WHERE con.contype = 'f' AND n.nspname = 'public' AND pn.nspname = 'public'
              AND parent.relname = ANY($1::text[])
            GROUP BY n.nspname, child.relname, con.conname, parent.relname, con.confdeltype, con.confmatchtype
        `, [[...identityDataTables]])
        for (const row of droppedConstraints.rows) {
            if (!identityDataTables.includes(row.table_name as typeof identityDataTables[number])) {
                await query(`
                    INSERT INTO identity_data_local_foreign_keys (
                        constraint_name, child_schema, child_table, parent_table,
                        child_columns, parent_columns, delete_action, match_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [row.conname, row.schema_name, row.table_name, row.parent_table,
                    row.child_columns, row.parent_columns, row.delete_action, row.match_type])
            }
            await query(`ALTER TABLE ${quoteIdentifier(row.schema_name)}.${quoteIdentifier(row.table_name)} DROP CONSTRAINT ${quoteIdentifier(row.conname)}`)
        }

        for (const name of [...identityDataTables].reverse()) {
            if (localTables.includes(name)) await query(`DROP TABLE public.${quoteIdentifier(name)}`)
        }
        await installIdentityDeleteTriggerFunction(query)
        await installIdentityForeignKeyCheckTriggerFunction(query)
        const externalChildTables = new Set(droppedConstraints.rows
            .filter(row => !identityDataTables.includes(row.table_name as typeof identityDataTables[number]))
            .map(row => `${row.schema_name as string}.${row.table_name as string}`))
        for (const table of externalChildTables) {
            const [schemaName, tableName] = table.split('.')
            await query(`
                CREATE TRIGGER identity_data_boundary_foreign_key_check
                BEFORE INSERT OR UPDATE ON ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}
                FOR EACH ROW EXECUTE FUNCTION identity_data_boundary_check_foreign_keys()
            `)
        }
        for (const name of identityDataTables) {
            await query(`CREATE VIEW public.${quoteIdentifier(name)} AS SELECT * FROM identity_data_remote.${quoteIdentifier(name)}`)
            await query(`
                CREATE TRIGGER identity_data_boundary_delete
                INSTEAD OF DELETE ON public.${quoteIdentifier(name)}
                FOR EACH ROW EXECUTE FUNCTION identity_data_boundary_delete()
            `)
        }
        await query(`
            CREATE TABLE identity_data_boundary (
                version TEXT PRIMARY KEY,
                row_counts JSONB NOT NULL,
                migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
        await query('INSERT INTO identity_data_boundary (version, row_counts) VALUES ($1, $2::jsonb)', ['identity-db-v1', JSON.stringify(counts)])
    }, { timeoutMs: 180_000, statementTimeoutMs: 30_000 })

    markIdentityDataDetached()
    console.info('Identity-owned tables now reside in the independent Identity PostgreSQL database.')
    return true
}

async function installIdentityForeignKeyCheckTriggerFunction(query: (sql: string, params?: (string | number | null | boolean | string[] | Date)[]) => Promise<unknown>) {
    await query(`
        CREATE FUNCTION identity_data_boundary_check_foreign_keys() RETURNS trigger
        LANGUAGE plpgsql
        AS $identity_boundary$
        DECLARE
            foreign_key RECORD;
            new_row JSONB := to_jsonb(NEW);
            old_row JSONB;
            child_values TEXT[];
            predicate TEXT;
            column_index INTEGER;
            null_count INTEGER;
            parent_exists BOOLEAN;
            changed BOOLEAN;
        BEGIN
            IF TG_OP = 'UPDATE' THEN old_row := to_jsonb(OLD); END IF;
            FOR foreign_key IN
                SELECT * FROM identity_data_local_foreign_keys
                 WHERE child_schema = TG_TABLE_SCHEMA AND child_table = TG_TABLE_NAME
                 ORDER BY constraint_name
            LOOP
                child_values := ARRAY[]::TEXT[];
                null_count := 0;
                changed := TG_OP = 'INSERT';
                FOR column_index IN 1..array_length(foreign_key.child_columns, 1) LOOP
                    child_values := array_append(child_values, new_row ->> foreign_key.child_columns[column_index]);
                    IF child_values[column_index] IS NULL THEN null_count := null_count + 1; END IF;
                    IF TG_OP = 'UPDATE'
                       AND old_row ->> foreign_key.child_columns[column_index]
                           IS DISTINCT FROM child_values[column_index] THEN
                        changed := TRUE;
                    END IF;
                END LOOP;
                IF NOT changed THEN CONTINUE; END IF;

                IF null_count > 0 THEN
                    IF foreign_key.match_type = 'f' AND null_count < array_length(foreign_key.child_columns, 1) THEN
                        RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "%"',
                            TG_TABLE_NAME, foreign_key.constraint_name
                            USING ERRCODE = '23503', CONSTRAINT = foreign_key.constraint_name;
                    END IF;
                    CONTINUE;
                END IF;

                predicate := '';
                FOR column_index IN 1..array_length(foreign_key.parent_columns, 1) LOOP
                    IF column_index > 1 THEN predicate := predicate || ' AND '; END IF;
                    predicate := predicate || format('%I = %L', foreign_key.parent_columns[column_index], child_values[column_index]);
                END LOOP;
                EXECUTE format('SELECT EXISTS (SELECT 1 FROM identity_data_remote.%I WHERE %s)', foreign_key.parent_table, predicate)
                   INTO parent_exists;
                IF NOT parent_exists THEN
                    RAISE EXCEPTION 'insert or update on table "%" violates foreign key constraint "%"',
                        TG_TABLE_NAME, foreign_key.constraint_name
                        USING ERRCODE = '23503', CONSTRAINT = foreign_key.constraint_name;
                END IF;
            END LOOP;
            RETURN NEW;
        END
        $identity_boundary$
    `)
}

async function installIdentityDeleteTriggerFunction(query: (sql: string, params?: (string | number | null | boolean | string[] | Date)[]) => Promise<unknown>) {
    await query(`
        CREATE FUNCTION identity_data_boundary_delete() RETURNS trigger
        LANGUAGE plpgsql
        AS $identity_boundary$
        DECLARE
            foreign_key RECORD;
            key_columns TEXT[];
            old_row JSONB := to_jsonb(OLD);
            predicate TEXT;
            assignments TEXT;
            column_index INTEGER;
            column_name TEXT;
            child_exists BOOLEAN;
            deleted_rows BIGINT;
        BEGIN
            FOR foreign_key IN
                SELECT * FROM identity_data_local_foreign_keys
                 WHERE parent_table = TG_TABLE_NAME
                 ORDER BY child_table, constraint_name
            LOOP
                predicate := '';
                FOR column_index IN 1..array_length(foreign_key.child_columns, 1) LOOP
                    IF column_index > 1 THEN predicate := predicate || ' AND '; END IF;
                    predicate := predicate || format('%I = %L', foreign_key.child_columns[column_index], old_row ->> foreign_key.parent_columns[column_index]);
                END LOOP;

                IF foreign_key.delete_action = 'c' THEN
                    EXECUTE format('DELETE FROM %I.%I WHERE %s', foreign_key.child_schema, foreign_key.child_table, predicate);
                ELSIF foreign_key.delete_action IN ('n', 'd') THEN
                    assignments := '';
                    FOREACH column_name IN ARRAY foreign_key.child_columns LOOP
                        IF assignments <> '' THEN assignments := assignments || ', '; END IF;
                        IF foreign_key.delete_action = 'n' THEN
                            assignments := assignments || format('%I = NULL', column_name);
                        ELSE
                            assignments := assignments || format('%I = DEFAULT', column_name);
                        END IF;
                    END LOOP;
                    EXECUTE format('UPDATE %I.%I SET %s WHERE %s', foreign_key.child_schema, foreign_key.child_table, assignments, predicate);
                ELSE
                    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %s)', foreign_key.child_schema, foreign_key.child_table, predicate)
                       INTO child_exists;
                    IF child_exists THEN
                        RAISE EXCEPTION 'delete violates constraint %', foreign_key.constraint_name
                            USING ERRCODE = '23503', CONSTRAINT = foreign_key.constraint_name;
                    END IF;
                END IF;
            END LOOP;

            SELECT boundary_keys.key_columns INTO key_columns
              FROM identity_data_boundary_keys boundary_keys
             WHERE boundary_keys.table_name = TG_TABLE_NAME;
            IF key_columns IS NULL THEN
                RAISE EXCEPTION 'Identity boundary has no delete key for %', TG_TABLE_NAME;
            END IF;
            predicate := '';
            FOR column_index IN 1..array_length(key_columns, 1) LOOP
                IF column_index > 1 THEN predicate := predicate || ' AND '; END IF;
                predicate := predicate || format('%I = %L', key_columns[column_index], old_row ->> key_columns[column_index]);
            END LOOP;
            EXECUTE format('DELETE FROM identity_data_remote.%I WHERE %s', TG_TABLE_NAME, predicate);
            GET DIAGNOSTICS deleted_rows = ROW_COUNT;
            IF deleted_rows = 0 THEN RETURN NULL; END IF;
            RETURN OLD;
        END
        $identity_boundary$
    `)
}

function identityDatabaseEnabled() {
    return process.env.HANASAND_IDENTITY_DB_ENABLED === '1' || process.env.NODE_ENV === 'production'
}

function quoteIdentifier(value: string) {
    return `"${value.replaceAll('"', '""')}"`
}

function quoteLiteral(value: string) {
    return `'${value.replaceAll('\'', '\'\'')}'`
}
