release_has_schema_changes() {
    previous_release=$1
    target_release=$2
    # VM host assignment is a separately marked, host-specific reconciliation;
    # actual DDL in that module is still caught by the SQL-token scan below.
    if ! git diff --quiet "$previous_release" "$target_release" -- \
        db \
        api/src/utils/db/existingSchema.ts \
        ':(glob)api/src/utils/db/*Schema.ts' \
        ':(exclude)api/src/utils/db/ensureSchema.ts' \
        ':(exclude)api/src/utils/db/vmLifecycleSchema.ts'; then
        return 0
    fi
    for path in $(git diff --name-only "$previous_release" "$target_release" -- api/src); do
        test "$path" = api/src/utils/db/logSearchIndexes.ts && continue
        test "$path" = api/src/utils/sshKeyUsage.ts && continue
        # The release marker table is bookkeeping, not application schema.
        # Remove only its CREATE phrase, leaving the rest of a possibly
        # multi-statement diff line visible to the DDL scan.
        if git diff --unified=0 "$previous_release" "$target_release" -- "$path" \
            | grep '^+[^+]' \
            | tr '[:lower:]' '[:upper:]' \
            | sed 's/CREATE TABLE IF NOT EXISTS APP_SCHEMA_RELEASES//g' \
            | grep -Eiq '([^[:alnum:]_])(CREATE|ALTER|DROP|TRUNCATE|REINDEX|GRANT|REVOKE)([[:space:]]|$)'; then
            return 0
        fi
    done
    return 1
}

reuse_schema_marker_for_code_only_release() {
    previous_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_api 2>/dev/null \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    case "$previous_release" in
        *[!a-f0-9]*|'') return 0 ;;
    esac
    test "${#previous_release}" -eq 40 || return 0
    test "$previous_release" != "$release" || return 0
    if release_has_schema_changes "$previous_release" "$release"; then
        return 0
    fi
    schema_changes_required=0

    previous_schema_applied=$(docker exec hanasand_database psql -U hanasand -d hanasand -Atc \
        "SELECT EXISTS (SELECT 1 FROM app_schema_releases WHERE release = '$previous_release')" 2>/dev/null || true)
    if test "$previous_schema_applied" != t; then
        schema_changes_required=1
        return 0
    fi

    docker exec hanasand_database psql -v ON_ERROR_STOP=1 -U hanasand -d hanasand \
        -c "INSERT INTO app_schema_releases (release) VALUES ('$release') ON CONFLICT DO NOTHING" >/dev/null
    echo "Reused the applied database schema marker for code-only release $release."
}
