export async function installIdentityForeignKeyCheckTriggerFunction(query: (sql: string, params?: (string | number | null | boolean | string[] | Date)[]) => Promise<unknown>) {
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

export async function installIdentityDeleteTriggerFunction(query: (sql: string, params?: (string | number | null | boolean | string[] | Date)[]) => Promise<unknown>) {
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
