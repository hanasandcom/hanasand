release_has_schema_changes() {
    previous_release=$1
    target_release=$2
    # Re-run main-database schema setup when its SQL files changed. Changes to
    # ensureSchema.ts are classified by the DDL check below, allowing Identity-
    # only setup to run before the main database release marker is checked.
    if ! git diff --quiet "$previous_release" "$target_release" -- \
        db \
        api/src/utils/db/existingSchema.ts \
        ':(glob)api/src/utils/db/*Schema.ts' \
        ':(exclude)api/src/utils/db/ensureSchema.ts'; then
        return 0
    fi
    for path in $(git diff --name-only "$previous_release" "$target_release" -- api/src); do
        test "$path" = api/src/utils/db/logSearchIndexes.ts && continue
        # The SSH usage table is provisioned directly in Identity at startup.
        test "$path" = api/src/utils/sshKeyUsage.ts && continue
        if git diff --unified=0 "$previous_release" "$target_release" -- "$path" \
            | grep -Eiq '^\+[^+].*([^[:alnum:]_])(CREATE|ALTER|DROP|TRUNCATE|REINDEX|GRANT|REVOKE)([[:space:]]|$)'; then
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

sh "$root/scripts/require-main.sh"
git fetch origin main
git merge --ff-only FETCH_HEAD
sh "$root/scripts/require-main.sh"
release=$(git rev-parse HEAD)
# The shell parsed this file before fetching. Re-exec once from the fast-forwarded
# checkout so deployment behavior matches the release being built.
if test "${HANASAND_DEPLOY_REFRESHED_RELEASE:-}" != "$release"; then
    exec env HANASAND_DEPLOY_LOCK_HELD=1 HANASAND_DEPLOY_REFRESHED_RELEASE="$release" \
        "$root/scripts/deploy-all.sh" "$@"
fi
sh "$root/scripts/require-compose-healthchecks.sh"

# Deployment-control-only commits do not change the application containers.
# Verify the currently served release and return before preparing a build tree,
# materializing runtime assets, or rebuilding every image.
running_api_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_api 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
running_frontend_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
case "$running_api_release" in
    *[!a-f0-9]*|'') running_api_release= ;;
esac
if test "${#running_api_release}" -ne 40 || test "$running_frontend_release" != "$running_api_release"; then
    running_api_release=
fi
if test -n "$running_api_release" \
    && git merge-base --is-ancestor "$running_api_release" "$release" \
    && git diff --quiet "$running_api_release" "$release" -- . \
        ':(exclude)scripts/deploy-all.sh' ':(exclude)scripts/deploy-all/**' ':(exclude)scripts/verify-stack-release.sh'; then
    if HANASAND_VERIFY_LIVE_RELEASE_ONLY=1 \
        sh "$root/scripts/verify-stack-release.sh" "$running_api_release"; then
        running_api_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8082/health)
        running_frontend_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3100/api/health)
        case "$running_api_health" in *'"ok":true'*"\"release\":\"$running_api_release\""*) ;; *)
            echo "The running API did not report its verified release; continuing with a full deployment." >&2
            running_api_release=
            ;;
        esac
        case "$running_frontend_health" in *'"ok":true'*"\"release\":\"$running_api_release\""*'"api"'*) ;; *)
            echo "The running frontend did not report its verified release; continuing with a full deployment." >&2
            running_api_release=
            ;;
        esac
        if test -n "$running_api_release"; then
            echo "Only deployment-control files changed; verified application release $running_api_release remains healthy. Skipping image builds and service recreation."
            exit 0
        fi
    else
        echo "The current application stack did not pass verification; continuing with a full deployment."
    fi
fi
schema_changes_required=1
reuse_schema_marker_for_code_only_release
